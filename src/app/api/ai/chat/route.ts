import { NextResponse } from 'next/server'
import { executeQuery } from '@/lib/supabase/mock-db-server'
import type { Product, KnowledgeDocument } from '@/types'

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface APIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

interface ChatMessage {
  role?: 'system' | 'user' | 'assistant' | 'tool';
  sender_type?: 'customer' | 'agent' | 'bot';
  content_text?: string;
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface CustomFieldRow {
  id: string;
  user_id: string;
  field_name: string;
  field_type: string;
  created_at: string;
}

interface ContactCustomValueRow {
  id: string;
  contact_id: string;
  custom_field_id: string;
  value: string;
  created_at: string;
}

async function updateContactStandardFields(
  contact_id: string,
  updates: { name?: string; email?: string; company?: string }
): Promise<void> {
  const dataToUpdate: Record<string, string> = {}
  if (updates.name) dataToUpdate.name = updates.name
  if (updates.email) dataToUpdate.email = updates.email
  if (updates.company) dataToUpdate.company = updates.company

  if (Object.keys(dataToUpdate).length === 0) return

  await executeQuery({
    action: 'update',
    tableName: 'contacts',
    filters: [{ col: 'id', op: 'eq', val: contact_id }],
    data: dataToUpdate,
  })
}

async function updateContactCustomField(
  contact_id: string,
  fieldName: string,
  value: string
): Promise<void> {
  const customFieldsRes = await executeQuery({
    action: 'select',
    tableName: 'custom_fields',
  })
  const customFields = (customFieldsRes.data || []) as CustomFieldRow[]

  const fieldNameClean = fieldName.toLowerCase().trim()
  const matchedField = customFields.find((cf) => {
    const cfNameClean = cf.field_name.toLowerCase().trim()
    return (
      cfNameClean === fieldNameClean ||
      cfNameClean.normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
        fieldNameClean.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    )
  })

  if (!matchedField) return

  const existingRes = await executeQuery({
    action: 'select',
    tableName: 'contact_custom_values',
    filters: [
      { col: 'contact_id', op: 'eq', val: contact_id },
      { col: 'custom_field_id', op: 'eq', val: matchedField.id },
    ],
  })
  const existing = existingRes.data?.[0] as ContactCustomValueRow | undefined

  if (existing) {
    await executeQuery({
      action: 'update',
      tableName: 'contact_custom_values',
      filters: [{ col: 'id', op: 'eq', val: existing.id }],
      data: { value },
    })
  } else {
    await executeQuery({
      action: 'insert',
      tableName: 'contact_custom_values',
      data: {
        contact_id,
        custom_field_id: matchedField.id,
        value,
      },
    })
  }
}

export async function POST(request: Request) {
  try {
    const { messages, contact_id } = (await request.json()) as {
      messages?: ChatMessage[]
      contact_id?: string
    }
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 })
    }

    // 1. Get active agent (or fallback to any agent)
    const agentRes = await executeQuery({
      action: 'select',
      tableName: 'ai_agents',
      filters: [{ col: 'is_active', op: 'eq', val: true }],
      limitCount: 1,
    })
    let agent = agentRes.data?.[0]
    if (!agent) {
      const fallbackRes = await executeQuery({
        action: 'select',
        tableName: 'ai_agents',
        limitCount: 1,
      })
      agent = fallbackRes.data?.[0]
    }
    if (!agent) {
      return NextResponse.json({ error: 'No AI agent found' }, { status: 404 })
    }

    // 2. Get active products context
    const productsRes = await executeQuery({
      action: 'select',
      tableName: 'products',
      filters: [{ col: 'active', op: 'eq', val: true }]
    })
    const products = productsRes.data || []
    const productsContext = products
      .map(
        (p: Product) =>
          `- ${p.name} (SKU: ${p.sku || 'N/A'}, Prix: ${p.price} ${
            p.currency
          }, Description: ${p.description || 'N/A'})`
      )
      .join('\n')

    // 3. Local RAG Retrieval (Semantic keyword-matching)
    const lastMessage =
      messages[messages.length - 1]?.content_text ||
      messages[messages.length - 1]?.content ||
      ''
    const lastMessageLower = lastMessage.toLowerCase()

    const docsRes = await executeQuery({
      action: 'select',
      tableName: 'knowledge_base'
    })
    const documents = (docsRes.data || []) as KnowledgeDocument[]

    // Tokenize query into alphanumeric terms of length >= 3, excluding common stop words
    const FRENCH_STOP_WORDS = new Set([
      'les', 'des', 'une', 'qui', 'que', 'est', 'pour', 'dans', 'avec', 'sans', 'plus',
      'mais', 'donc', 'elle', 'nous', 'vous', 'ils', 'elles', 'leur', 'ses', 'ces', 'aux',
      'quel', 'quelle', 'quelles', 'quels', 'comment', 'pourquoi', 'tout', 'tous', 'cette'
    ])

    const queryTerms = lastMessage
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length >= 3 && !FRENCH_STOP_WORDS.has(term))

    let rankedDocs = documents.map((doc) => {
      let score = 0
      const fileNameLower = doc.file_name.toLowerCase()
      const contentLower = doc.content.toLowerCase()
      
      // Normalize hyphens/underscores to align compound words (e.g. wi-fi -> wifi)
      const cleanFileName = fileNameLower.replace(/[-_]/g, '')
      const cleanContent = contentLower.replace(/[-_]/g, '')

      for (const term of queryTerms) {
        // High score weight if query term is in file name
        if (cleanFileName.includes(term)) {
          score += 15
        }
        // Count whole word occurrences in normalized document content
        const regex = new RegExp('\\b' + term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'gi')
        const matches = cleanContent.match(regex)
        if (matches) {
          score += matches.length
        }
      }
      return { doc, score }
    })

    // Filter documents with matching terms and sort by score descending
    rankedDocs = rankedDocs
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)

    // Select the top 2 most relevant documents
    const topDocs = rankedDocs.slice(0, 2).map((item) => item.doc)

    let ragContext = ''
    if (topDocs.length > 0) {
      ragContext = topDocs
        .map(
          (doc) =>
            `[CONNAISSANCES COMPLÉMENTAIRES]\nDocument: ${doc.file_name}\nContenu: ${doc.content}`
        )
        .join('\n\n')
    }

    const systemPromptWithContext = `${ragContext ? ragContext + '\n\n' : ''}${agent.system_prompt}

Voici la liste actuelle de nos PRODUITS & SERVICES :
${productsContext}

Voici le lien de réservation Calendly si besoin : ${
      agent.calendly_link || 'Non configuré'
    }`

    const openAiApiKey = process.env.OPENAI_API_KEY

    if (openAiApiKey) {
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'update_contact_info',
            description: 'Met à jour les informations d\'un contact (nom, email, entreprise) et ses champs personnalisés.',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Le prénom et/ou nom du contact.' },
                email: { type: 'string', description: 'L\'adresse email du contact.' },
                company: { type: 'string', description: 'Le nom de l\'entreprise du contact.' },
                custom_fields: {
                  type: 'object',
                  description: 'Un dictionnaire de champs personnalisés (ex: budget, besoin, échéance, etc.) avec leurs valeurs correspondantes.',
                  additionalProperties: { type: 'string' }
                }
              }
            }
          }
        }
      ]

      const formattedMessages = [
        { role: 'system', content: systemPromptWithContext },
        ...messages.map((m: ChatMessage) => ({
          role: m.role || (m.sender_type === 'customer' ? 'user' : 'assistant'),
          content: m.content_text || m.content || '',
        })),
      ]

      const payload: {
        model: string
        messages: APIMessage[]
        temperature: number
        tools?: typeof tools
        tool_choice?: 'auto'
      } = {
        model: agent.model || 'gpt-4o-mini',
        messages: formattedMessages as APIMessage[],
        temperature: agent.temperature ?? 0.7,
      }

      if (contact_id) {
        payload.tools = tools
        payload.tool_choice = 'auto'
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiApiKey}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('OpenAI API Error:', errorText)
        return NextResponse.json(
          { error: 'OpenAI API returned an error: ' + errorText },
          { status: response.status }
        )
      }

      const resData = await response.json()
      const messageObj = resData.choices?.[0]?.message
      let answer = messageObj?.content || ''
      const toolCalls = messageObj?.tool_calls

      if (toolCalls && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          if (toolCall.function.name === 'update_contact_info') {
            try {
              const args = JSON.parse(toolCall.function.arguments)
              if (contact_id) {
                await updateContactStandardFields(contact_id, {
                  name: args.name,
                  email: args.email,
                  company: args.company,
                })
                if (args.custom_fields && typeof args.custom_fields === 'object') {
                  for (const [key, val] of Object.entries(args.custom_fields)) {
                    if (typeof val === 'string') {
                      await updateContactCustomField(contact_id, key, val)
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Error processing tool call arguments:', e)
            }
          }
        }

        const secondMessages = [
          ...formattedMessages,
          messageObj,
          ...toolCalls.map((tc: ToolCall) => ({
            role: 'tool' as const,
            tool_call_id: tc.id,
            name: tc.function.name,
            content: JSON.stringify({ success: true, message: 'Contact info updated in CRM' })
          }))
        ]

        const secondResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiApiKey}`,
          },
          body: JSON.stringify({
            model: agent.model || 'gpt-4o-mini',
            messages: secondMessages,
            temperature: agent.temperature ?? 0.7,
          }),
        })

        if (secondResponse.ok) {
          const secondData = await secondResponse.json()
          answer = secondData.choices?.[0]?.message?.content || ''
        }
      }

      return NextResponse.json({ answer })
    } else {
      // Simulator lead qualification fallback
      if (contact_id) {
        const emailMatch = lastMessage.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
        if (emailMatch) {
          await updateContactStandardFields(contact_id, { email: emailMatch[0] })
        }

        const namePatterns = [
          /je m['’]appelle\s+([^.,?!]+)/i,
          /mon nom est\s+([^.,?!]+)/i,
          /moi c['’]est\s+([^.,?!]+)/i,
          /je suis\s+([^.,?!]+)/i
        ]
        let nameExtracted = ''
        for (const pattern of namePatterns) {
          const match = lastMessage.match(pattern)
          if (match && match[1]) {
            const potentialName = match[1].trim()
            const words = potentialName.toLowerCase().split(/\s+/)
            const blacklist = ['intéressé', 'intéressée', 'disponible', 'dispo', 'vendeur', 'client', 'prospect', 'ravi', 'ravie', 'enchanté', 'enchantée', 'prêt', 'prête', 'un', 'une', 'le', 'la', 'les', 'en', 'très']
            const isBlacklisted = words.some(w => blacklist.includes(w))
            if (!isBlacklisted && potentialName.length > 1) {
              nameExtracted = potentialName
              break
            }
          }
        }
        if (nameExtracted) {
          await updateContactStandardFields(contact_id, { name: nameExtracted })
        }

        const companyPatterns = [
          /je travaille chez\s+([^.,?!]+)/i,
          /mon entreprise est\s+([^.,?!]+)/i,
          /ma soci[eé]t[eé] est\s+([^.,?!]+)/i,
          /la soci[eé]t[eé]\s+([^.,?!]+)/i
        ]
        let companyExtracted = ''
        for (const pattern of companyPatterns) {
          const match = lastMessage.match(pattern)
          if (match && match[1]) {
            companyExtracted = match[1].trim()
            break
          }
        }
        if (companyExtracted) {
          await updateContactStandardFields(contact_id, { company: companyExtracted })
        }

        // Custom fields parsing
        // Budget
        const budgetPatterns = [
          /budget(?:\s+est)?(?:\s+de)?\s*(?:environ)?\s*(\d+(?:\s*\d+)?\s*(?:€|\$|eur|dollars|euros))/i,
          /(\d+(?:\s*\d+)?\s*(?:€|\$|eur|dollars|euros))\s*(?:de\s*)?budget/i
        ]
        let budgetExtracted = ''
        for (const pattern of budgetPatterns) {
          const match = lastMessage.match(pattern)
          if (match && match[1]) {
            budgetExtracted = match[1].trim()
            break
          }
        }
        if (budgetExtracted) {
          await updateContactCustomField(contact_id, 'budget', budgetExtracted)
        }

        // Besoin / Need
        const needPatterns = [
          /besoin\s+d['’](?:un|une|)\s*([^.,?!]+)/i,
          /besoin\s+de\s*([^.,?!]+)/i,
          /recherche\s+(?:un|une|)\s*([^.,?!]+)/i
        ]
        let needExtracted = ''
        for (const pattern of needPatterns) {
          const match = lastMessage.match(pattern)
          if (match && match[1]) {
            needExtracted = match[1].trim()
            break
          }
        }
        if (needExtracted) {
          await updateContactCustomField(contact_id, 'besoin', needExtracted)
        }

        // Échéance
        const deadlinePatterns = [
          /échéance\s*(?::|est)\s*([^.,?!]+)/i,
          /d'ici\s+([^.,?!]+)/i,
          /pour\s+(?:fin|début)?\s*(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|la semaine prochaine|ce mois-ci|20\d{2})/i
        ]
        let deadlineExtracted = ''
        for (const pattern of deadlinePatterns) {
          const match = lastMessage.match(pattern)
          if (match && match[1]) {
            deadlineExtracted = match[1].trim()
            break
          }
        }
        if (deadlineExtracted) {
          await updateContactCustomField(contact_id, 'échéance', deadlineExtracted)
        }
      }

      // Fallback: Smart Local Simulation incorporating RAG and products
      let answer = "Bonjour ! Je suis l'assistant WaPulse. Comment puis-je vous aider ?"

      if (topDocs.length > 0) {
        const primaryDoc = topDocs[0]
        answer = `[Simulation RAG - Basé sur ${primaryDoc.file_name}]\n${primaryDoc.content}`
      } else if (
        lastMessageLower.includes('prix') ||
        lastMessageLower.includes('tarif') ||
        lastMessageLower.includes('cout') ||
        lastMessageLower.includes('coût')
      ) {
        if (products.length > 0) {
          answer = `Voici les tarifs de nos produits et services actuels :\n${products
            .map((p: Product) => `- *${p.name}* : ${p.price} ${p.currency}`)
            .join('\n')}\n\nLequel de ces produits vous intéresse ?`
        } else {
          answer = "Nos tarifs dépendent de vos besoins. N'hésitez pas à planifier un appel pour en discuter !"
        }
      } else if (
        lastMessageLower.includes('rdv') ||
        lastMessageLower.includes('rendez-vous') ||
        lastMessageLower.includes('calendly') ||
        lastMessageLower.includes('appel') ||
        lastMessageLower.includes('dispo')
      ) {
        answer = `Vous pouvez réserver un créneau de discussion directement via mon Calendly ici : ${
          agent.calendly_link || 'https://calendly.com/wapulse-demo/intro'
        }. J'ai hâte d'échanger avec vous !`
      } else if (
        lastMessageLower.includes('produit') ||
        lastMessageLower.includes('acheter') ||
        lastMessageLower.includes('offre') ||
        lastMessageLower.includes('service')
      ) {
        if (products.length > 0) {
          const mainProduct = products[0]
          answer = `Nous proposons plusieurs offres, dont *${mainProduct.name}* pour seulement ${
            mainProduct.price
          } ${mainProduct.currency}. ${
            mainProduct.description || ''
          }\nSouhaitez-vous commander cet article ou préférez-vous voir nos autres services ?`
        } else {
          answer = "Nous proposons diverses prestations de service sur-mesure. Pouvez-vous détailler votre besoin ?"
        }
      } else {
        answer = `[Simulation IA - ${agent.name}]\nMerci pour votre message ! Je fonctionne en mode de simulation local hors-ligne. Mon prompt système me demande d'agir ainsi :\n\n"${agent.system_prompt.slice(
          0,
          200
        )}..."`
      }

      await new Promise((resolve) => setTimeout(resolve, 800))
      return NextResponse.json({ answer })
    }
  } catch (err: unknown) {
    console.error('Error in AI Chat API route:', err)
    const errorMessage = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

