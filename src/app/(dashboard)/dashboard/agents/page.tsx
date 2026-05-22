"use client"

import { useEffect, useState, useTransition, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AIAgentConfig, KnowledgeDocument } from '@/types'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/hooks/use-translation'

interface SandboxContact {
  id: string
  name: string
  email: string | null
  company: string | null
  phone: string | null
}

interface SandboxCustomField {
  id: string
  field_name: string
  field_type: string
}

interface SandboxCustomValue {
  id: string
  contact_id: string
  custom_field_id: string
  value: string
}
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  Brain,
  Cpu,
  Save,
  MessageSquare,
  Send,
  RefreshCw,
  Sparkles,
  Bot,
  User,
  AlertTriangle,
  Upload,
  Trash2,
  Plus,
  FileText,
  Database,
} from 'lucide-react'

export default function AgentsPage() {
  const { t, language } = useTranslation()
  const [agent, setAgent] = useState<AIAgentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startSaveTransition] = useTransition()

  // Form states
  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [temperature, setTemperature] = useState(0.7)
  const [isAgentActive, setIsAgentActive] = useState(true)
  const [calendlyLink, setCalendlyLink] = useState('')

  // Knowledge Base RAG states
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [activeTab, setActiveTab] = useState('settings')

  // Document creation states
  const [manualTitle, setManualTitle] = useState('')
  const [manualContent, setManualContent] = useState('')
  const [isInsertingDoc, setIsInsertingDoc] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Preview document state
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDocument | null>(null)

  // Chat preview sandbox states
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  // Sandbox lead qualification states
  const [sandboxContact, setSandboxContact] = useState<SandboxContact | null>(null)
  const [customFields, setCustomFields] = useState<SandboxCustomField[]>([])
  const [customValues, setCustomValues] = useState<SandboxCustomValue[]>([])
  const [loadingQualification, setLoadingQualification] = useState(false)

  const db = createClient()

  const loadDocuments = useCallback(async () => {
    try {
      const { data, error } = await db
        .from('knowledge_base')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setDocuments(data || [])
    } catch (err) {
      console.error('Error loading knowledge base:', err)
    } finally {
      setLoadingDocs(false)
    }
  }, [db])

  const loadQualificationData = useCallback(async () => {
    setLoadingQualification(true)
    try {
      // 1. Fetch sandbox contact info
      const contactRes = await db
        .from('contacts')
        .select('*')
        .eq('id', 'c-sandbox')
        .maybeSingle()
      if (contactRes.data) {
        setSandboxContact(contactRes.data as SandboxContact)
      }

      // 2. Fetch custom fields
      const fieldsRes = await db
        .from('custom_fields')
        .select('*')
      if (fieldsRes.data) {
        setCustomFields(fieldsRes.data as SandboxCustomField[])
      }

      // 3. Fetch custom values for sandbox contact
      const valuesRes = await db
        .from('contact_custom_values')
        .select('*')
        .eq('contact_id', 'c-sandbox')
      if (valuesRes.data) {
        setCustomValues(valuesRes.data as SandboxCustomValue[])
      }
    } catch (err) {
      console.error('Error loading sandbox qualification data:', err)
    } finally {
      setLoadingQualification(false)
    }
  }, [db])

  const handleResetSandbox = async () => {
    try {
      // Reset contact profile fields to defaults
      await db
        .from('contacts')
        .update({
          name: 'Sandbox Test Contact',
          email: 'sandbox.test@example.com',
          company: 'Sandbox Inc.',
        })
        .eq('id', 'c-sandbox')

      // Delete custom values for this contact
      await db
        .from('contact_custom_values')
        .delete()
        .eq('contact_id', 'c-sandbox')

      // Clear the sandbox chat
      handleClearChat()

      // Reload state
      await loadQualificationData()
      toast.success(t("Sandbox reset successfully!"))
    } catch (err) {
      console.error('Error resetting sandbox:', err)
      toast.error(t("Error resetting sandbox."))
    }
  }

  useEffect(() => {
    const loadAgentConfig = async () => {
      setLoading(true)
      try {
        const { data, error } = await db.from('ai_agents').select('*').limit(1)
        if (error) throw error

        if (data && data.length > 0) {
          const config = data[0]
          setAgent(config)
          setName(config.name)
          setSystemPrompt(config.system_prompt)
          setModel(config.model)
          setTemperature(config.temperature)
          setIsAgentActive(config.is_active)
          setCalendlyLink(config.calendly_link || '')
        }
      } catch (err) {
        console.error('Error loading AI agent config:', err)
        toast.error(t("Failed to load agent configuration."))
      } finally {
        setLoading(false)
      }
    }

    loadAgentConfig()
    loadDocuments()
    loadQualificationData()
  }, [db, loadDocuments, loadQualificationData])

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()
    if (!agent) return

    startSaveTransition(async () => {
      try {
        const { error } = await db
          .from('ai_agents')
          .update({
            name,
            system_prompt: systemPrompt,
            model,
            temperature,
            is_active: isAgentActive,
            calendly_link: calendlyLink || null,
          })
          .eq('id', agent.id)

        if (error) throw error
        toast.success(t("Agent configuration saved successfully!"))
        
        // Refresh local cache
        setAgent({
          ...agent,
          name,
          system_prompt: systemPrompt,
          model,
          temperature,
          is_active: isAgentActive,
          calendly_link: calendlyLink,
        })
      } catch (err) {
        console.error('Error saving AI settings:', err)
        toast.error(t("Error saving settings."))
      }
    })
  }

  // File Upload Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      await handleFileUpload(files[0])
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      await handleFileUpload(files[0])
    }
  }

  const handleFileUpload = async (file: File) => {
    const validExtensions = ['txt', 'md']
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!validExtensions.includes(ext)) {
      toast.error(t("Unsupported file format. Please use a .txt or .md file"))
      return
    }

    setIsInsertingDoc(true)
    try {
      const text = await file.text()
      const { error } = await db.from('knowledge_base').insert({
        file_name: file.name,
        file_type: ext,
        file_size: file.size,
        content: text,
        user_id: agent?.user_id || '00000000-0000-0000-0000-000000000000'
      })
      if (error) throw error
      toast.success(`${t("File")} "${file.name}" ${t("imported successfully!")}`)
      loadDocuments()
    } catch (err) {
      console.error('Error uploading file:', err)
      toast.error(t("Error importing file."))
    } finally {
      setIsInsertingDoc(false)
    }
  }

  // Manual Document Handler
  const handleCreateManualDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualTitle.trim() || !manualContent.trim()) {
      toast.error(t("Please fill in the document title and content."))
      return
    }

    setIsInsertingDoc(true)
    try {
      let fileName = manualTitle.trim()
      if (!fileName.endsWith('.txt') && !fileName.endsWith('.md')) {
        fileName += '.txt'
      }

      const { error } = await db.from('knowledge_base').insert({
        file_name: fileName,
        file_type: 'txt',
        file_size: new Blob([manualContent]).size,
        content: manualContent,
        user_id: agent?.user_id || '00000000-0000-0000-0000-000000000000'
      })
      if (error) throw error
      toast.success(t("Document created successfully!"))
      setManualTitle('')
      setManualContent('')
      loadDocuments()
    } catch (err) {
      console.error('Error creating manual doc:', err)
      toast.error(t("Error creating document."))
    } finally {
      setIsInsertingDoc(false)
    }
  }

  // Delete Document Handler
  const handleDeleteDoc = async (docId: string) => {
    if (!confirm(t("Are you sure you want to delete this document?"))) return
    try {
      const { error } = await db.from('knowledge_base').delete().eq('id', docId)
      if (error) throw error
      toast.success(t("Document deleted successfully!"))
      loadDocuments()
    } catch (err) {
      console.error('Error deleting document:', err)
      toast.error(t("Error deleting document."))
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || isSending) return

    const userText = inputMessage.trim()
    setInputMessage('')

    // Append user message
    const updatedMessages = [...chatMessages, { role: 'user' as const, content: userText }]
    setChatMessages(updatedMessages)
    setIsSending(true)

    try {
      // Post to our local API route
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content_text: m.content,
          })),
          contact_id: 'c-sandbox',
        }),
      })

      if (!response.ok) {
        throw new Error('API returned ' + response.status)
      }

      const resData = await response.json()
      if (resData.error) {
        throw new Error(resData.error)
      }

      // Append assistant message
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant' as const, content: resData.answer },
      ])

      // Re-fetch qualification data instantly after response
      await loadQualificationData()
    } catch (err: unknown) {
      console.error('Error sending message to simulator:', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant' as const,
          content: `⚠️ [${t("Error")}] ${t("Failed to communicate with AI engine")} : ${errorMessage}`,
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const handleClearChat = () => {
    setChatMessages([])
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} ${t("B")}`
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(1)} ${t("KB")}`
    return `${(kb / 1024).toFixed(1)} ${t("MB")}`
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="h-6 w-6 text-violet-500" />
            {t("AI Agent Configuration")}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {t("Configure the behavior, model, and response rules of your virtual WhatsApp agent.")}
          </p>
        </div>
        <div>
          <Badge
            className={`px-3 py-1 font-medium transition-all ${
              isAgentActive
                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <span
              className={`mr-1.5 h-2 w-2 rounded-full inline-block ${
                isAgentActive ? 'bg-violet-500 animate-pulse' : 'bg-slate-500'
              }`}
            />
            {isAgentActive ? t('AI Agent Active') : t('AI Disabled')}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 items-start">
        {/* Left Column: Settings and Knowledge base Tabs */}
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
            <TabsList className="bg-slate-900 border border-slate-800 p-1 flex w-full max-w-md">
              <TabsTrigger
                value="settings"
                className="flex-1 text-slate-400 data-active:bg-slate-800 data-active:text-violet-400"
              >
                <Cpu className="h-4 w-4 mr-2" />
                {t("General Settings")}
              </TabsTrigger>
              <TabsTrigger
                value="knowledge"
                className="flex-1 text-slate-400 data-active:bg-slate-800 data-active:text-violet-400"
              >
                <Database className="h-4 w-4 mr-2" />
                {t("Knowledge Base")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="mt-0">
              <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 text-lg">
                    <Cpu className="h-5 w-5 text-violet-400" /> {t("General Settings")}
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {t("Adjust identity, language model, and creativity parameters.")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="agent-name" className="text-slate-300">{t("Agent Name")}</Label>
                      <Input
                        id="agent-name"
                        required
                        placeholder={t("AI Sales Assistant")}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="agent-model" className="text-slate-300">{t("LLM Model")}</Label>
                        <select
                          id="agent-model"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-1 text-sm shadow-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        >
                          <option value="gpt-4o-mini">{t("GPT-4o Mini (Recommended - Fast)")}</option>
                          <option value="gpt-4o">{t("GPT-4o (Creative & Accurate)")}</option>
                          <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                        </select>
                      </div>

                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="agent-temp" className="text-slate-300">{t("Temperature")} ({temperature})</Label>
                          <span className="text-[10px] text-slate-500">{t("Precise vs Creative")}</span>
                        </div>
                        <input
                          id="agent-temp"
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-violet-600 focus:outline-none mt-2"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="agent-prompt" className="text-slate-300 flex items-center justify-between">
                        <span>{t("System Prompt (Instructions)")}</span>
                        <Badge className="bg-violet-600/10 text-violet-400 border border-violet-500/10 text-[10px] py-0">
                          {t("AI Role")}
                        </Badge>
                      </Label>
                      <Textarea
                        id="agent-prompt"
                        required
                        placeholder={t("You are the virtual sales assistant...")}
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-500 min-h-[160px] font-mono text-xs leading-relaxed"
                      />
                      <p className="text-[10px] text-slate-500 leading-normal">
                        {t("* The product and service catalog is automatically injected into the prompt context so the AI can respond accurately to pricing questions.")}
                      </p>
                    </div>

                    <div className="grid gap-2">
                       <Label htmlFor="agent-calendly" className="text-slate-300">{t("Calendly Link (Appointment Booking)")}</Label>
                      <Input
                        id="agent-calendly"
                        placeholder="https://calendly.com/votre-nom"
                        value={calendlyLink}
                        onChange={(e) => setCalendlyLink(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-500"
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-slate-800 p-3 bg-slate-950/40">
                      <div className="space-y-0.5">
                        <Label htmlFor="agent-active" className="text-slate-200">{t("Enable auto replies")}</Label>
                        <p className="text-xs text-slate-400">
                          {t("Allows the AI to instantly reply to messages received on WhatsApp.")}
                        </p>
                      </div>
                      <Switch
                        id="agent-active"
                        checked={isAgentActive}
                        onCheckedChange={setIsAgentActive}
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isPending}
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium flex items-center justify-center gap-2"
                    >
                      {isPending ? (
                        <>
                           <RefreshCw className="h-4 w-4 animate-spin" /> {t("Saving...")}
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" /> {t("Save Configuration")}
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="knowledge" className="space-y-6 mt-0">
              {/* Document Creation Forms */}
              <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 text-lg">
                     <Upload className="h-5 w-5 text-violet-400" /> {t("Add documents")}
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {t("Enrich your agent's knowledge base for hyper-contextualized answers.")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    {/* Drag & Drop File Upload */}
                    <div className="space-y-2">
                       <Label className="text-slate-300">{t("Import a file")}</Label>
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[180px] ${
                          isDragging
                            ? 'border-violet-500 bg-violet-500/10'
                            : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/60'
                        }`}
                        onClick={() => document.getElementById('file-upload-input')?.click()}
                      >
                        <input
                          id="file-upload-input"
                          type="file"
                          accept=".txt,.md"
                          className="hidden"
                          onChange={handleFileSelect}
                          disabled={isInsertingDoc}
                        />
                        {isInsertingDoc ? (
                          <RefreshCw className="h-8 w-8 animate-spin text-violet-500 mb-2" />
                        ) : (
                          <Upload className="h-8 w-8 text-slate-500 mb-2 group-hover:text-violet-400 transition-colors" />
                        )}
                         <p className="text-xs text-slate-300 font-medium">
                          {t("Drag & drop a .txt or .md file")}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {t("Or click to browse your files")}
                        </p>
                      </div>
                    </div>

                    {/* Manual Document Entry Form */}
                    <form onSubmit={handleCreateManualDoc} className="space-y-4">
                      <div className="space-y-2">
                         <Label htmlFor="doc-title" className="text-slate-300">{t("Manual Entry (FAQ / Instructions)")}</Label>
                        <Input
                          id="doc-title"
                          placeholder={t("Document title (e.g. Return Policy)")}
                          value={manualTitle}
                          onChange={(e) => setManualTitle(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-500 text-xs"
                          disabled={isInsertingDoc}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Textarea
                           placeholder={t("Instructions or FAQ content...")}
                          value={manualContent}
                          onChange={(e) => setManualContent(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 focus-visible:ring-violet-500 min-h-[100px] text-xs"
                          disabled={isInsertingDoc}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={isInsertingDoc}
                        className="w-full bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium flex items-center justify-center gap-2 text-xs"
                      >
                        <Plus className="h-4 w-4" /> {t("Add to Knowledge")}
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>

              {/* Documents List */}
              <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2 text-lg">
                    <Database className="h-5 w-5 text-violet-400" /> {t("Knowledge Documents")}
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {t("These documents form the active knowledge base queried by RAG.")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingDocs ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-violet-500" />
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 border border-slate-800 rounded-lg bg-slate-950/20">
                      <FileText className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-400">{t("No documents in the database")}</p>
                      <p className="text-xs text-slate-600 mt-1">{t("Import a file to start instructing the AI.")}</p>
                    </div>
                  ) : (
                    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/20">
                      <Table>
                        <TableHeader className="bg-slate-950/50 border-b border-slate-800">
                          <TableRow className="border-slate-800 hover:bg-transparent">
                            <TableHead className="text-slate-400 text-xs font-semibold px-4 py-3">{t("File")}</TableHead>
                            <TableHead className="text-slate-400 text-xs font-semibold px-4 py-3">{t("Type")}</TableHead>
                            <TableHead className="text-slate-400 text-xs font-semibold px-4 py-3">{t("Size")}</TableHead>
                            <TableHead className="text-slate-400 text-xs font-semibold px-4 py-3">{t("Import Date")}</TableHead>
                            <TableHead className="text-slate-400 text-xs font-semibold px-4 py-3 text-right">{t("Actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {documents.map((doc) => (
                            <TableRow key={doc.id} className="border-slate-800 hover:bg-slate-900/40">
                              <TableCell className="px-4 py-3 font-medium text-slate-200 text-xs">
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc(doc)}
                                  className="hover:underline text-left text-violet-400 hover:text-violet-300 font-semibold"
                                >
                                  {doc.file_name}
                                </button>
                              </TableCell>
                              <TableCell className="px-4 py-3 text-xs">
                                <Badge
                                  className={
                                    doc.file_type === 'md'
                                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                      : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                                  }
                                >
                                  {doc.file_type.toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-4 py-3 text-slate-400 text-xs">
                                {formatSize(doc.file_size)}
                              </TableCell>
                              <TableCell className="px-4 py-3 text-slate-400 text-xs">
                                {formatDate(doc.created_at)}
                              </TableCell>
                              <TableCell className="px-4 py-3 text-right text-xs">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteDoc(doc.id)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Sandbox Console Preview */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-md flex flex-col h-[500px] overflow-hidden">
            <CardHeader className="border-b border-slate-800 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4 text-violet-400" /> {t("Test Console")}
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  {t("Simulate a real-time conversation.")}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearChat}
                className="text-xs text-slate-400 hover:bg-slate-800 hover:text-white h-7 py-0 px-2"
              >
                {t("Clear")}
              </Button>
            </CardHeader>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/40">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                  <div className="h-10 w-10 rounded-full bg-violet-600/10 flex items-center justify-center text-violet-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-200">{t("Experimentation Sandbox")}</h3>
                    <p className="text-xs text-slate-400 max-w-xs leading-normal">
                      {t("Send a message to test the AI Agent. For example, ask \"what are your prices?\" or \"how to book an appointment?\".")}
                    </p>
                  </div>
                  
                  {/* Warning if no api key */}
                  {!process.env.NEXT_PUBLIC_OPENAI_API_KEY && (
                    <div className="mt-4 flex items-start gap-2 text-left rounded-lg bg-amber-950/20 border border-amber-500/10 p-3 max-w-xs">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-400 leading-normal">
                        {t("Simulation Mode active (no API key detected). The AI will respond locally in an intelligent way based on the knowledge base and catalog.")}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-2.5 ${
                      msg.role === 'user' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <div
                      className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-xs ${
                        msg.role === 'user'
                          ? 'bg-slate-800 text-slate-200'
                          : 'bg-violet-600 text-white'
                      }`}
                    >
                      {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div
                      className={`rounded-lg px-3 py-2 text-xs max-w-[80%] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-slate-800 text-slate-100'
                          : 'bg-violet-600/10 border border-violet-500/20 text-slate-100'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}

              {isSending && (
                <div className="flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-violet-600 text-white shrink-0 flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-lg px-3 py-2 bg-violet-600/10 border border-violet-500/20 flex gap-1 items-center h-8">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce delay-100" />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce delay-200" />
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2">
              <Input
                placeholder={t("Chat with the agent...")}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isSending}
                className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-violet-500 text-xs py-1"
              />
              <Button
                type="submit"
                disabled={isSending || !inputMessage.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-white size-8 p-0 shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </Card>

          {/* Lead Qualification Panel */}
          <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-md">
            <CardHeader className="border-b border-slate-800 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-violet-400" /> {t("Lead Qualification (Real Time)")}
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  {t("Contact fields and custom data extracted by AI.")}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetSandbox}
                disabled={loadingQualification}
                className="text-xs border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white h-7 gap-1.5 px-2.5"
              >
                <RefreshCw className={`h-3 w-3 ${loadingQualification ? 'animate-spin' : ''}`} /> {t("Reset")}
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Profil Standard */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("Standard Profile")}</h4>
                <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
                  <div>
                    <span className="text-[10px] text-slate-500 block">{t("Full name")}</span>
                    <span className="text-xs font-medium text-slate-200 block truncate">
                      {sandboxContact?.name || <span className="text-slate-600 italic">{t("Unqualified")}</span>}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">{t("Company")}</span>
                    <span className="text-xs font-medium text-slate-200 block truncate">
                      {sandboxContact?.company || <span className="text-slate-600 italic">{t("Unqualified")}</span>}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-500 block">{t("Email Address")}</span>
                    <span className="text-xs font-medium text-slate-200 block truncate">
                      {sandboxContact?.email || <span className="text-slate-600 italic">{t("Unqualified")}</span>}
                    </span>
                  </div>
                </div>
              </div>

              {/* Champs Personnalisés */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("Custom Fields")}</h4>
                {customFields.length === 0 ? (
                  <p className="text-[11px] text-slate-600 italic px-2">{t("No custom fields configured.")}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
                    {customFields.map((field) => {
                      const matchedValue = customValues.find((v) => v.custom_field_id === field.id)
                      return (
                        <div key={field.id} className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 block capitalize">{field.field_name}</span>
                          <span className="text-xs font-medium text-slate-200 block truncate">
                            {matchedValue?.value || <span className="text-slate-600 italic">{t("Not filled")}</span>}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-violet-400" />
                {previewDoc.file_name}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-white"
              >
                {t("Close")}
              </Button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-slate-300 whitespace-pre-wrap bg-slate-950/60 leading-relaxed max-h-[50vh]">
              {previewDoc.content}
            </div>
            <div className="p-4 bg-slate-950/20 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
              <span>{t("Size:")} {formatSize(previewDoc.file_size)}</span>
              <span>{t("Import date:")} {formatDate(previewDoc.created_at)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

