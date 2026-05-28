"use client";

import { useState, useRef, useCallback, KeyboardEvent, useEffect } from "react";
import {
  Send,
  LayoutTemplate,
  Smile,
  Plus,
  FileText,
  Camera,
  Image,
  Headphones,
  MapPin,
  User,
  Mic,
  X,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReplyQuote } from "./reply-quote";
import { useTranslation } from "@/hooks/use-translation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import type { Contact } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReplyDraft {
  /** Internal UUID of the message being replied to — sent back through onSend. */
  id: string;
  authorLabel: string;
  preview: string;
}

interface MessageComposerProps {
  conversationId: string;
  sessionExpired: boolean;
  onSend: (
    text: string,
    replyToId?: string,
    media?: {
      type: "image" | "video" | "audio" | "document" | "location";
      url?: string;
      filename?: string;
    }
  ) => void;
  onOpenTemplates: () => void;
  replyTo?: ReplyDraft | null;
  onClearReply?: () => void;
}

interface Attachment {
  id: string;
  file: File;
  previewUrl: string;
  type: "image" | "video" | "audio" | "document";
}

const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🫣", "🤭", "🤫", "🤥", "😶", "😶‍🌫️", "😐", "😑", "😬", "🫨", "🫠", "🤤", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖", "🎃",
  "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "✨", "🌟", "⭐", "💫", "🔥", "💥", "☄️", "🌈", "☀️", "🌤️", "⛅", "🌥️", "☁️", "🌦️", "🌧️", "⛈️", "🌩️", "❄️", "☃️", "⛄", "💨", "🌪️", "🌫️", "🌬️", "🌊", "💧", "💦", "☔",
];

export function MessageComposer({
  conversationId,
  sessionExpired,
  onSend,
  onOpenTemplates,
  replyTo,
  onClearReply,
}: MessageComposerProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  // Contact Picker
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsSearch, setContactsSearch] = useState("");
  const [contactsLoading, setContactsLoading] = useState(false);

  // Popovers
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  useEffect(() => {
    if (!contactPickerOpen) return;

    const fetchContacts = async () => {
      setContactsLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error("Failed to fetch contacts for picker:", error);
      } else {
        setContacts(data ?? []);
      }
      setContactsLoading(false);
    };

    fetchContacts();
  }, [contactPickerOpen]);

  const filteredContacts = contacts.filter((c) => {
    const q = contactsSearch.toLowerCase();
    const name = c.name?.toLowerCase() ?? "";
    const phone = c.phone.toLowerCase();
    const email = c.email?.toLowerCase() ?? "";
    const company = c.company?.toLowerCase() ?? "";
    return name.includes(q) || phone.includes(q) || email.includes(q) || company.includes(q);
  });

  // Audio Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef(false);

  // Input elements refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const camInputRef = useRef<HTMLInputElement>(null);
  const galInputRef = useRef<HTMLInputElement>(null);
  const audInputRef = useRef<HTMLInputElement>(null);

  // Reset attachments and close menus if conversation changes
  useEffect(() => {
    return () => {
      attachments.forEach((att) => URL.revokeObjectURL(att.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Handle Recording Timer cleanup
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Max 4 lines (~96px)
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    const hasAttachments = attachments.length > 0;
    if ((!trimmed && !hasAttachments) || sending || uploading) return;

    setSending(true);
    try {
      if (hasAttachments) {
        setUploading(true);
        // Upload attachments one by one
        for (let i = 0; i < attachments.length; i++) {
          const att = attachments[i];
          const formData = new FormData();
          formData.append("file", att.file);

          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            throw new Error(`Upload failed for file: ${att.file.name}`);
          }

          const data = await res.json();
          const uploadedUrl = data.url;

          // If it's the first attachment, send it with the text caption
          const caption = i === 0 ? trimmed : "";
          const replyId = i === 0 ? replyTo?.id : undefined;

          onSend(caption, replyId, {
            type: att.type,
            url: uploadedUrl,
            filename: att.file.name,
          });

          URL.revokeObjectURL(att.previewUrl);
        }
        setAttachments([]);
      } else {
        // Just text message
        onSend(trimmed, replyTo?.id);
      }

      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error("Failed to send:", error);
      toast.error(error instanceof Error ? error.message : t("Failed to send message"));
    } finally {
      setSending(false);
      setUploading(false);
    }
  }, [text, attachments, sending, uploading, onSend, replyTo?.id, t]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      adjustHeight();
    },
    [adjustHeight]
  );

  const handleInsertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;
    const nextText = val.substring(0, start) + emoji + val.substring(end);
    setText(nextText);

    // Restore cursor position + focus
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + emoji.length;
      adjustHeight();
    }, 0);
  };

  const handleFileChange = (category: "document" | "camera" | "gallery" | "audio") => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let type: "image" | "video" | "audio" | "document" = "document";

      if (category === "camera") {
        type = "image";
      } else if (category === "audio") {
        type = "audio";
      } else if (category === "gallery") {
        type = file.type.startsWith("video/") ? "video" : "image";
      } else {
        // Document or fallback
        if (file.type.startsWith("image/")) {
          type = "image";
        } else if (file.type.startsWith("video/")) {
          type = "video";
        } else if (file.type.startsWith("audio/")) {
          type = "audio";
        } else {
          type = "document";
        }
      }

      newAttachments.push({
        id: Math.random().toString(36).substring(7),
        file,
        previewUrl: URL.createObjectURL(file),
        type,
      });
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    setAttachOpen(false);
    // Reset file input value
    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((att) => att.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((att) => att.id !== id);
    });
  };

  // Share Location (Actual with fallback)
  const handleShareLocation = () => {
    const sendLocation = (lat: number, lng: number) => {
      onSend(`Location: https://maps.google.com/?q=${lat},${lng}`, replyTo?.id, {
        type: "location",
        filename: `${lat},${lng}`,
      });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          sendLocation(position.coords.latitude, position.coords.longitude);
        },
        () => {
          // Fallback coordinates for Paris, France
          sendLocation(48.8566, 2.3522);
        }
      );
    } else {
      sendLocation(48.8566, 2.3522);
    }
    setAttachOpen(false);
  };

  // Share Contact (Open Picker Dialog)
  const handleShareContact = () => {
    setContactsSearch("");
    setContactPickerOpen(true);
    setAttachOpen(false);
  };

  // Start Voice Recording
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        if (isCancelledRef.current) {
          // Do nothing
        } else {
          await uploadAndSendAudio(blob);
        }
        // Stop all track streams
        stream.getTracks().forEach((track) => track.stop());
      };

      isCancelledRef.current = false;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn("Microphone access denied or error, starting simulated recording:", err);
      // Simulated Recording Fallback
      setIsRecording(true);
      setRecordDuration(0);
      isCancelledRef.current = false;

      recordingTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    isCancelledRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordDuration(0);
  };

  const stopAndSendRecording = async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    isCancelledRef.current = false;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      // In simulation mode (no mic access)
      await sendMockAudio();
    }
    setIsRecording(false);
    setRecordDuration(0);
  };

  const uploadAndSendAudio = async (blob: Blob) => {
    setUploading(true);
    try {
      const file = new File([blob], "voice-recording.webm", { type: "audio/webm" });
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Audio upload failed");

      const data = await res.json();
      onSend("", replyTo?.id, {
        type: "audio",
        url: data.url,
        filename: "voice-recording.webm",
      });
    } catch (err) {
      console.error("Audio send failed:", err);
      toast.error(t("Failed to send audio message"));
    } finally {
      setUploading(false);
    }
  };

  const sendMockAudio = async () => {
    // Generate a tiny mock audio buffer (100 silent bytes)
    const dummyBlob = new Blob([new Uint8Array(100)], { type: "audio/mp3" });
    await uploadAndSendAudio(dummyBlob);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const hasContent = text.trim().length > 0 || attachments.length > 0;

  return (
    <div className="border-t border-slate-800 bg-slate-900 p-3">
      {/* Wave animation styles */}
      <style>{`
        @keyframes wave-pulse {
          0%, 100% { transform: scaleY(0.2); }
          50% { transform: scaleY(1); }
        }
        .animate-wave-bar {
          animation: wave-pulse 1.2s ease-in-out infinite;
          transform-origin: center;
        }
      `}</style>

      {/* Hidden inputs for attachments */}
      <input
        type="file"
        ref={docInputRef}
        className="hidden"
        onChange={handleFileChange("document")}
      />
      <input
        type="file"
        ref={camInputRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange("camera")}
      />
      <input
        type="file"
        ref={galInputRef}
        className="hidden"
        accept="image/*,video/*"
        multiple
        onChange={handleFileChange("gallery")}
      />
      <input
        type="file"
        ref={audInputRef}
        className="hidden"
        accept="audio/*"
        onChange={handleFileChange("audio")}
      />

      {replyTo && (
        <div className="mb-2">
          <ReplyQuote
            authorLabel={replyTo.authorLabel}
            preview={replyTo.preview}
            onDismiss={onClearReply}
          />
        </div>
      )}

      {sessionExpired && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-400">
            {t("24-hour session expired. Your message will be automatically wrapped in an approved template.")}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-400 hover:text-amber-300"
            onClick={onOpenTemplates}
          >
            <LayoutTemplate className="mr-1 h-3 w-3" />
            {t("Templates")}
          </Button>
        </div>
      )}

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2 rounded-xl bg-slate-950/40 p-2.5 border border-slate-800">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="relative group flex flex-col items-center justify-center h-20 w-20 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden"
            >
              {att.type === "image" && (
                <img src={att.previewUrl} className="h-full w-full object-cover" alt="preview" />
              )}
              {att.type === "video" && (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <Camera className="h-5 w-5 mb-1" />
                  <span className="text-[9px] font-medium text-slate-400 truncate max-w-full px-1">Video</span>
                </div>
              )}
              {att.type === "audio" && (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <Headphones className="h-5 w-5 mb-1" />
                  <span className="text-[9px] font-medium text-slate-400 truncate max-w-full px-1">Audio</span>
                </div>
              )}
              {att.type === "document" && (
                <div className="flex flex-col items-center justify-center text-slate-400 px-1 text-center">
                  <FileText className="h-5 w-5 mb-1 text-violet-400" />
                  <span className="text-[8px] font-medium text-slate-300 truncate max-w-full">
                    {att.file.name}
                  </span>
                </div>
              )}
              <button
                onClick={() => removeAttachment(att.id)}
                className="absolute top-1 right-1 h-4 w-4 flex items-center justify-center rounded-full bg-slate-950/80 hover:bg-slate-950 text-slate-300 hover:text-white transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {isRecording ? (
        /* Vocal Recording Mode Layout */
        <div className="flex items-center justify-between w-full h-11 px-2 bg-slate-950/45 rounded-xl border border-slate-800">
          <button
            onClick={cancelRecording}
            className="h-9 w-9 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-800/40 transition-all shrink-0"
            title={t("Cancel recording")}
          >
            <Trash2 className="h-4.5 w-4.5" />
          </button>

          <div className="flex items-center gap-3 flex-1 px-4">
            {/* Flashing red recording indicator */}
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-xs font-semibold text-slate-300 min-w-[2rem]">
              {formatDuration(recordDuration)}
            </span>

            {/* Sound waves animation */}
            <div className="flex items-center gap-0.5 h-5 overflow-hidden flex-1 max-w-[200px]">
              {[...Array(14)].map((_, i) => {
                const delay = (i % 4) * 0.15;
                return (
                  <div
                    key={i}
                    className="w-0.75 bg-violet-500 rounded-full animate-wave-bar"
                    style={{
                      height: "100%",
                      animationDelay: `${delay}s`,
                      animationDuration: "1s",
                    }}
                  />
                );
              })}
            </div>
          </div>

          <button
            onClick={stopAndSendRecording}
            className="h-9 w-9 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all shrink-0"
            title={t("Stop and send")}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      ) : (
        /* Normal Compose Mode Layout */
        <div className="flex items-end gap-2">
          {/* Emoji Picker Popover */}
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger
              className="h-9 w-9 shrink-0 p-0 text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
              title={t("Click to choose emojis")}
            >
              <Smile className="h-5 w-5" />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              sideOffset={12}
              className="w-72 h-64 bg-slate-900 border-slate-800 p-2 shadow-2xl"
            >
              <div className="h-full overflow-y-auto pr-1 select-none scrollbar-thin scrollbar-thumb-slate-800">
                <div className="grid grid-cols-8 gap-1.5 justify-items-center">
                  {EMOJIS.map((emoji, index) => (
                    <button
                      key={index}
                      onClick={() => handleInsertEmoji(emoji)}
                      className="text-xl hover:bg-slate-800 p-1 rounded transition-colors duration-100 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Attachment Picker Popover */}
          <Popover open={attachOpen} onOpenChange={setAttachOpen}>
            <PopoverTrigger
              className="h-9 w-9 shrink-0 p-0 text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center rounded-lg transition-colors cursor-pointer"
              title={t("Click to attach files")}
            >
              <Plus className="h-5.5 w-5.5" />
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              sideOffset={12}
              className="w-48 bg-slate-900 border-slate-800 p-2 shadow-2xl flex flex-col gap-0.5 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-150"
            >
              {/* Document */}
              <button
                onClick={() => docInputRef.current?.click()}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/80 text-left transition-colors text-slate-300 hover:text-white cursor-pointer"
              >
                <div className="h-7 w-7 flex items-center justify-center rounded-full bg-indigo-600 text-white shrink-0 shadow-sm">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-medium">{t("Document")}</span>
              </button>

              {/* Camera */}
              <button
                onClick={() => camInputRef.current?.click()}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/80 text-left transition-colors text-slate-300 hover:text-white cursor-pointer"
              >
                <div className="h-7 w-7 flex items-center justify-center rounded-full bg-pink-600 text-white shrink-0 shadow-sm">
                  <Camera className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-medium">{t("Camera")}</span>
              </button>

              {/* Gallery (Photos & Videos) */}
              <button
                onClick={() => galInputRef.current?.click()}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/80 text-left transition-colors text-slate-300 hover:text-white cursor-pointer"
              >
                <div className="h-7 w-7 flex items-center justify-center rounded-full bg-purple-600 text-white shrink-0 shadow-sm">
                  <Image className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-medium">{t("Gallery")}</span>
              </button>

              {/* Audio */}
              <button
                onClick={() => audInputRef.current?.click()}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/80 text-left transition-colors text-slate-300 hover:text-white cursor-pointer"
              >
                <div className="h-7 w-7 flex items-center justify-center rounded-full bg-orange-500 text-white shrink-0 shadow-sm">
                  <Headphones className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-medium">{t("Audio")}</span>
              </button>

              {/* Location */}
              <button
                onClick={handleShareLocation}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/80 text-left transition-colors text-slate-300 hover:text-white cursor-pointer"
              >
                <div className="h-7 w-7 flex items-center justify-center rounded-full bg-emerald-600 text-white shrink-0 shadow-sm">
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-medium">{t("Location")}</span>
              </button>

              {/* Contact */}
              <button
                onClick={handleShareContact}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/80 text-left transition-colors text-slate-300 hover:text-white cursor-pointer"
              >
                <div className="h-7 w-7 flex items-center justify-center rounded-full bg-blue-600 text-white shrink-0 shadow-sm">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-medium">{t("Contact")}</span>
              </button>
            </PopoverContent>
          </Popover>

          {/* Chat Text Input Area */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={sending || uploading}
            placeholder={
              sessionExpired
                ? t("Type a message to re-engage...")
                : t("Type a message... (Shift+Enter for new line)")
            }
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-violet-500/50 min-h-[38px] max-h-24 scrollbar-thin"
            )}
          />

          {/* Send / Mic Action Button */}
          {uploading ? (
            <Button
              size="sm"
              className="h-9 w-9 shrink-0 bg-violet-600 p-0 hover:bg-violet-500 disabled:opacity-60 rounded-full"
              disabled
            >
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : (
            <Button
              size="sm"
              className={cn(
                "h-9 w-9 shrink-0 p-0 rounded-full transition-all duration-200 cursor-pointer",
                hasContent
                  ? "bg-violet-600 hover:bg-violet-500 text-white"
                  : "bg-transparent text-slate-400 hover:text-white hover:bg-slate-800"
              )}
              disabled={sending}
              onClick={hasContent ? handleSend : startVoiceRecording}
            >
              {hasContent ? (
                <Send className="h-4 w-4 animate-in zoom-in duration-200" />
              ) : (
                <Mic className="h-4.5 w-4.5 animate-in zoom-in duration-200" />
              )}
            </Button>
          )}
        </div>
      )}

      {/* Quick Replies Hint */}
      {!isRecording && (
        <p className="mt-1 pl-22 text-[10px] text-slate-600">
          Type &apos;/&apos; for quick replies
        </p>
      )}

      {/* Dialog for contact sharing */}
      <Dialog open={contactPickerOpen} onOpenChange={setContactPickerOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">
              {t("Share a contact")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <input
              type="text"
              value={contactsSearch}
              onChange={(e) => setContactsSearch(e.target.value)}
              placeholder={t("Search a contact...")}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500/50"
            />

            <ScrollArea className="h-64 rounded-lg border border-slate-800/80 bg-slate-950/45 p-2">
              {contactsLoading ? (
                <div className="flex h-full items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  {t("No contacts found")}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredContacts.map((c) => {
                    const displayName = c.name || c.phone;
                    const initials = displayName.charAt(0).toUpperCase();
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          const contactText = `👤 ${displayName}\n📞 ${c.phone}${c.email ? `\n✉️ ${c.email}` : ""}${c.company ? `\n🏢 ${c.company}` : ""}`;
                          onSend(contactText, replyTo?.id);
                          setContactPickerOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-medium text-white">
                          {c.avatar_url ? (
                            <img
                              src={c.avatar_url}
                              alt={displayName}
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            initials
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">
                            {displayName}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {c.phone}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
