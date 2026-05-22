import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTextMessage, sendTemplateMessage, sendMediaMessage } from '@/lib/whatsapp/meta-api'
import { decrypt, encrypt, isLegacyFormat } from '@/lib/whatsapp/encryption'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Per-user rate limit. Bucket key is scoped to this route so
    // `/broadcast` has an independent budget.
    const limit = checkRateLimit(`send:${user.id}`, RATE_LIMITS.send)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const body = await request.json()
    const {
      conversation_id,
      message_type,
      content_text,
      media_url,
      template_name,
      template_params,
      reply_to_message_id,
    } = body

    if (!conversation_id || !message_type) {
      return NextResponse.json(
        { error: 'conversation_id and message_type are required' },
        { status: 400 }
      )
    }

    if (message_type === 'text' && !content_text) {
      return NextResponse.json(
        { error: 'content_text is required for text messages' },
        { status: 400 }
      )
    }

    if (message_type === 'template' && !template_name) {
      return NextResponse.json(
        { error: 'template_name is required for template messages' },
        { status: 400 }
      )
    }

    if (['image', 'video', 'audio', 'document'].includes(message_type) && !media_url) {
      return NextResponse.json(
        { error: 'media_url is required for media messages' },
        { status: 400 }
      )
    }

    let finalMessageType = message_type
    let finalContentText = content_text
    let finalTemplateName = template_name
    let finalTemplateParams = template_params
    let finalTemplateLanguage = 'en_US'

    // Fetch conversation and contact
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*, contact:contacts(*)')
      .eq('id', conversation_id)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Check if session is expired (24h window since last customer message)
    const { data: lastCustomerMsg, error: lastMsgError } = await supabase
      .from('messages')
      .select('created_at')
      .eq('conversation_id', conversation_id)
      .eq('sender_type', 'customer')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastMsgError) {
      console.error('[whatsapp/send] failed to fetch last customer message:', lastMsgError.message)
    }

    let isSessionExpired = false
    if (!lastCustomerMsg) {
      isSessionExpired = true
    } else {
      const hoursSince = (Date.now() - new Date(lastCustomerMsg.created_at).getTime()) / (1000 * 60 * 60)
      if (hoursSince >= 24) {
        isSessionExpired = true
      }
    }

    if (finalMessageType === 'text' && isSessionExpired) {
      // Find an approved template with exactly one parameter {{1}}
      const { data: approvedTemplates, error: tError } = await supabase
        .from('message_templates')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'Approved')

      if (tError) {
        console.error('[whatsapp/send] failed to fetch templates:', tError.message)
      }

      let genericTemplate = null
      if (approvedTemplates && approvedTemplates.length > 0) {
        // Prioritize templates with name containing "generic", "engage", "reply", "followup"
        genericTemplate = approvedTemplates.find(t => 
          (t.name.toLowerCase().includes('generic') || 
           t.name.toLowerCase().includes('engage') || 
           t.name.toLowerCase().includes('reply') ||
           t.name.toLowerCase().includes('followup')) &&
          t.body_text.includes('{{1}}') &&
          !t.body_text.includes('{{2}}')
        )

        // Fallback to any template containing {{1}} and not {{2}}
        if (!genericTemplate) {
          genericTemplate = approvedTemplates.find(t => 
            t.body_text.includes('{{1}}') && !t.body_text.includes('{{2}}')
          )
        }
      }

      if (genericTemplate) {
        finalMessageType = 'template'
        finalTemplateName = genericTemplate.name
        finalTemplateParams = [content_text]
        finalTemplateLanguage = genericTemplate.language
        // Save the rendered body text in the database so the chat feed shows it
        finalContentText = genericTemplate.body_text.replace(/\{\{1\}\}/g, content_text)
      } else {
        return NextResponse.json(
          { error: 'Session WhatsApp expirée (24h). Pour envoyer un message libre automatiquement, veuillez créer et faire approuver un modèle de message contenant uniquement {{1}} sur votre compte Meta (ex: "generic_reply"). Sinon, veuillez utiliser le bouton Modèles.' },
          { status: 403 }
        )
      }
    } else if (finalMessageType === 'template') {
      // Fetch the template's language if it's a standard template send
      const { data: tmpl } = await supabase
        .from('message_templates')
        .select('language')
        .eq('user_id', user.id)
        .eq('name', finalTemplateName)
        .limit(1)
        .maybeSingle()
      if (tmpl?.language) {
        finalTemplateLanguage = tmpl.language
      }
    }

    const contact = conversation.contact
    if (!contact?.phone) {
      return NextResponse.json(
        { error: 'Contact phone number not found' },
        { status: 400 }
      )
    }

    // Sanitize and validate phone
    const sanitizedPhone = sanitizePhoneForMeta(contact.phone)
    if (!isValidE164(sanitizedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // Fetch and decrypt WhatsApp config
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp not configured. Please set up your WhatsApp integration first.' },
        { status: 400 }
      )
    }

    const accessToken = decrypt(config.access_token)

    // Self-heal legacy CBC-encrypted tokens. Fire-and-forget: we
    // return from the send without waiting, so a failed upgrade just
    // means the next send tries again. The upgrade is idempotent —
    // concurrent sends both produce valid GCM ciphertexts of the same
    // plaintext, last write wins.
    if (isLegacyFormat(config.access_token)) {
      void supabase
        .from('whatsapp_config')
        .update({ access_token: encrypt(accessToken) })
        .eq('id', config.id)
        .then(({ error }) => {
          if (error) {
            console.warn(
              '[whatsapp/send] access_token GCM upgrade failed:',
              error.message,
            )
          }
        })
    }

    // Resolve the reply target (if any) to its Meta message_id, which is
    // what `context.message_id` on the outgoing Meta payload needs. The
    // parent must belong to this same conversation — otherwise a caller
    // could quote messages they can't see by guessing UUIDs.
    let contextMessageId: string | undefined
    if (reply_to_message_id) {
      const { data: parent, error: parentError } = await supabase
        .from('messages')
        .select('message_id, conversation_id')
        .eq('id', reply_to_message_id)
        .eq('conversation_id', conversation_id)
        .maybeSingle()

      if (parentError || !parent) {
        return NextResponse.json(
          { error: 'reply_to_message_id not found in this conversation' },
          { status: 400 }
        )
      }
      if (!parent.message_id) {
        // Parent never reached Meta (still in 'sending' or 'failed') — we
        // can't quote it on WhatsApp. Send without context rather than
        // dropping the message entirely.
        console.warn(
          '[whatsapp/send] reply target has no Meta message_id; sending without context'
        )
      } else {
        contextMessageId = parent.message_id
      }
    }

    // Send via Meta API — retry with phone-number variants if Meta rejects
    // with "recipient not in allowed list" (common in sandbox / when a
    // number was registered with/without a trunk 0). If an alternate
    // format succeeds, we persist it back to the contact row so the
    // next send goes through on the first attempt.
    let waMessageId = ''
    let workingPhone = sanitizedPhone

    const attempt = async (phone: string): Promise<string> => {
      if (finalMessageType === 'template') {
        const result = await sendTemplateMessage({
          phoneNumberId: config.phone_number_id,
          accessToken,
          to: phone,
          templateName: finalTemplateName,
          language: finalTemplateLanguage,
          params: finalTemplateParams || [],
          contextMessageId,
        })
        return result.messageId
      }
      if (['image', 'video', 'audio', 'document'].includes(finalMessageType)) {
        const result = await sendMediaMessage({
          phoneNumberId: config.phone_number_id,
          accessToken,
          to: phone,
          mediaType: finalMessageType as any,
          mediaUrl: media_url,
          caption: finalContentText || undefined,
          filename: finalMessageType === 'document' ? finalContentText || 'document' : undefined,
          contextMessageId,
        })
        return result.messageId
      }
      const result = await sendTextMessage({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: phone,
        text: finalContentText,
        contextMessageId,
      })
      return result.messageId
    }

    try {
      const variants = phoneVariants(sanitizedPhone)
      let lastError: unknown = null

      for (const variant of variants) {
        try {
          waMessageId = await attempt(variant)
          workingPhone = variant
          lastError = null
          break
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          // Only retry when the failure is specifically that the
          // recipient isn't in Meta's allowed list. Any other error
          // (bad token, invalid template, etc.) bubbles up immediately.
          if (!isRecipientNotAllowedError(message)) {
            throw err
          }
          lastError = err
          console.warn(`[whatsapp/send] variant "${variant}" rejected by Meta, trying next…`)
        }
      }

      if (lastError) throw lastError
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      console.error('Meta API send failed for all variants:', message)
      return NextResponse.json(
        { error: `Meta API error: ${message}` },
        { status: 502 }
      )
    }

    // If a non-original variant succeeded, update the contact so future
    // sends go straight through. sanitizePhoneForMeta on workingPhone
    // will yield workingPhone itself, so re-storing preserves it.
    if (workingPhone !== sanitizedPhone) {
      console.log(
        `[whatsapp/send] Auto-corrected contact phone: ${sanitizedPhone} → ${workingPhone}`
      )
      await supabase
        .from('contacts')
        .update({ phone: workingPhone })
        .eq('id', contact.id)
    }

    // Insert message into DB — field names MUST match the messages schema
    // (see supabase/migrations/001_initial_schema.sql):
    //   conversation_id, sender_type, content_type, content_text,
    //   media_url, template_name, message_id, status, created_at
    const { data: messageRecord, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        sender_type: 'agent',
        content_type: finalMessageType,
        content_text: finalContentText || null,
        media_url: media_url || null,
        template_name: finalTemplateName || null,
        message_id: waMessageId,
        status: 'sent',
        reply_to_message_id: reply_to_message_id || null,
      })
      .select()
      .single()

    if (msgError) {
      console.error('Error inserting sent message:', msgError)
      return NextResponse.json(
        { error: `Message sent to Meta but failed to save to DB: ${msgError.message}` },
        { status: 500 }
      )
    }

    // Update conversation
    await supabase
      .from('conversations')
      .update({
        last_message_text: finalContentText || `[${finalMessageType}]`,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation_id)

    return NextResponse.json({
      success: true,
      message_id: messageRecord.id,
      whatsapp_message_id: waMessageId,
    })
  } catch (error) {
    console.error('Error in WhatsApp send POST:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
