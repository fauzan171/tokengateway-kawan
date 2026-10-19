"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Markdown } from "./markdown";
import { DocumentsPanel } from "./documents-panel";
import { SourceList } from "./source-list";
import { PromptPicker } from "./prompt-picker";
import { MediaControls } from "./media-controls";
import {
  Send,
  Square,
  AlertCircle,
  Copy,
  Check,
  Pencil,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
  ImagePlus,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type TreeNode,
  buildAncestryPath,
  siblingsOf,
} from "@/lib/chat/tree";
import { IMAGE_MIMES, MAX_IMAGE_BYTES, MAX_IMAGES } from "@/lib/chat/content";
import { applyVariables } from "@/lib/prompts/variables";
import { useT, type Translate } from "@/lib/i18n/context";

const DEFAULT_MODEL = "deepseek-v4.1-flash";

interface ErrorState {
  message: string;
  retryable?: boolean;
  assistantId?: string;
}

function mapProviderError(t: Translate, code?: string, rawMsg?: string): { message: string; retryable: boolean } {
  if (code === "UNAUTHORIZED" || rawMsg?.includes("401") || rawMsg?.toLowerCase().includes("unauthorized")) {
    return { message: t("chat.keyRejected"), retryable: false };
  }
  if (code === "FORBIDDEN" || rawMsg?.includes("403")) {
    return { message: t("chat.forbidden"), retryable: false };
  }
  if (rawMsg?.includes("429") || rawMsg?.toLowerCase().includes("banyak permintaan")) {
    return { message: t("chat.rateLimited"), retryable: true };
  }
  if (code === "TIMEOUT" || rawMsg?.toLowerCase().includes("timeout")) {
    return { message: t("chat.timeout"), retryable: true };
  }
  if (code === "UPSTREAM_ERROR" || rawMsg?.includes("500") || rawMsg?.includes("502") || rawMsg?.includes("503")) {
    return { message: t("chat.upstream"), retryable: true };
  }
  if (rawMsg?.toLowerCase().includes("terputus") || rawMsg?.toLowerCase().includes("network")) {
    return { message: t("chat.disconnected"), retryable: true };
  }
  return { message: rawMsg || t("chat.genericError"), retryable: true };
}

function parseText(contentJson: string): string {
  try {
    const data = JSON.parse(contentJson);
    if (data?.parts && Array.isArray(data.parts)) {
      return data.parts.map((p: { text?: string }) => p.text || "").join("");
    }
  } catch {}
  return "";
}

function parseImages(contentJson: string): { mime: string; dataUrl: string }[] {
  try {
    const data = JSON.parse(contentJson);
    if (Array.isArray(data?.parts)) {
      return data.parts.filter(
        (p: { kind?: string; dataUrl?: string }) =>
          p?.kind === "image" && typeof p.dataUrl === "string",
      );
    }
  } catch {}
  return [];
}

function parseNote(contentJson: string): string | null {
  try {
    const data = JSON.parse(contentJson);
    if (!Array.isArray(data?.parts)) return null;
    const note = data.parts.find((p: { kind?: string; code?: string }) => p?.kind === "note");
    return typeof note?.code === "string" ? note.code : null;
  } catch {}
  return null;
}

type SourceView = { title: string; url: string };

function parseSources(contentJson: string): SourceView[] {
  try {
    const data = JSON.parse(contentJson);
    if (!Array.isArray(data?.parts)) return [];
    return data.parts.filter(
      (p: { kind?: string; url?: string }) => p?.kind === "source" && typeof p.url === "string" && p.url.startsWith("http"),
    ) as SourceView[];
  } catch {}
  return [];
}

type CitationView = {
  index: number;
  chunkId: string;
  filename: string;
  page: number | null;
};

function parseCitations(contentJson: string): CitationView[] {
  try {
    const data = JSON.parse(contentJson);
    if (!Array.isArray(data?.parts)) return [];
    return data.parts.filter(
      (p: { kind?: string; chunkId?: string }) =>
        p?.kind === "citation" && typeof p.chunkId === "string",
    );
  } catch {}
  return [];
}

function findLeaf(messages: readonly TreeNode[], startId: string): string {
  let curr = startId;
  while (true) {
    const children = messages
      .filter((m) => m.parentId === curr)
      .sort((a, b) => a.seq - b.seq);
    if (children.length === 0) break;
    curr = children[children.length - 1].id;
  }
  return curr;
}

export function ChatView({
  initialChatId = null,
  onChatCreated,
}: {
  initialChatId?: string | null;
  onChatCreated?: (id: string) => void;
} = {}) {
  const t = useT();
  const [messages, setMessages] = useState<TreeNode[]>([]);
  const [activeLeafId, setActiveLeafId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState<string | null>(initialChatId);

  // Sidebar memilih chat lain / "Chat baru": ikuti prop, jangan remount
  // (remount saat chat baru dibuat memutus SSE yang sedang berjalan).
  useEffect(() => {
    setChatId(initialChatId);
  }, [initialChatId]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeGenId, setActiveGenId] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  // Preferensi Enter (REQ-NT-70). Bawaan `true` = perilaku lama sampai
  // pengaturan termuat; gagal fetch tidak boleh mematikan tombol kirim.
  const [sendOnEnter, setSendOnEnter] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [attachments, setAttachments] = useState<{ mime: string; dataUrl: string }[]>([]);
  const [modelRef, setModelRef] = useState(DEFAULT_MODEL);
  const [vision, setVision] = useState(false);
  const [webSearchAvailable, setWebSearchAvailable] = useState(false);
  const [webSearchOn, setWebSearchOn] = useState(false);
  // Kapabilitas media (WP-NT-P8-01/03/04). Semua `false` sampai server
  // mengumumkannya; gagal fetch berarti kontrol tidak dirender sama sekali.
  const [mediaCaps, setMediaCaps] = useState({ imageGen: false, stt: false, tts: false });
  const [mediaBusy, setMediaBusy] = useState(false);
  // Satu area pratinjau: sitasi yang terakhir dibuka. `text: null` = memuat.
  const [openCitation, setOpenCitation] = useState<{
    messageId: string;
    chunkId: string;
    text: string | null;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tombol lampiran hanya muncul bila model yang dipakai chat ini mengumumkan visi
  // (REQ-NT-46: model tanpa visi tidak menampilkan tombol, bukan tombol mati).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/kawan/v1/models")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !Array.isArray(data?.models)) return;
        const model = data.models.find((m: { id?: string }) => m.id === modelRef);
        setVision(model?.capabilities?.vision === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [modelRef]);

  // Tombol pencarian web hanya muncul bila server mengonfigurasinya
  // (REQ-NT-51). Gagal fetch → tombol tidak ditampilkan, bukan tombol mati.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/kawan/v1/capabilities")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setWebSearchAvailable(data?.webSearch === true);
        setMediaCaps({
          imageGen: data?.imageGen === true,
          stt: data?.stt === true,
          tts: data?.tts === true,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Preferensi Enter/Shift+Enter dibaca sekali saat mount.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/kawan/v1/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const settings = data?.settings as { sendOnEnter?: unknown } | undefined;
        if (typeof settings?.sendOnEnter === "boolean") setSendOnEnter(settings.sendOnEnter);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const refreshChat = useCallback(async (id: string, preferredLeaf?: string | null) => {
    try {
      const res = await fetch(`/api/kawan/v1/chat/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        // API mengirim `content` (objek), bukan `contentJson` (string): tanpa
        // normalisasi ini setiap riwayat tampil "Tidak ada balasan".
        setMessages(
          data.messages.map((m: TreeNode & { content?: unknown }) => ({
            ...m,
            chatId: m.chatId ?? id,
            contentJson: m.contentJson ?? JSON.stringify(m.content ?? { parts: [] }),
          }))
        );
        const leaf = preferredLeaf !== undefined ? preferredLeaf : data.chat?.currentMessageId ?? null;
        setActiveLeafId(leaf);
        if (typeof data.chat?.modelRef === "string") setModelRef(data.chat.modelRef);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (chatId) {
      refreshChat(chatId);
    }
  }, [chatId, refreshChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeLeafId, isStreaming, scrollToBottom]);

  async function ensureChat(): Promise<string> {
    if (chatId) return chatId;
    const res = await fetch("/api/kawan/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t("chat.newChatTitle"), model: DEFAULT_MODEL }),
    });
    if (!res.ok) throw new Error(t("chat.createFailed"));
    const data = await res.json();
    setChatId(data.id);
    onChatCreated?.(data.id);
    return data.id;
  }

  async function streamSSE(
    activeId: string,
    generationId: string,
    assistantMessageId: string
  ) {
    setIsStreaming(true);
    setActiveGenId(generationId);
    setErrorState(null);

    try {
      const streamRes = await fetch(
        `/api/kawan/v1/chat/${activeId}/stream?generationId=${generationId}&afterSeq=0`,
        { headers: { Accept: "text/event-stream" } }
      );

      if (!streamRes.ok || !streamRes.body) {
        throw new Error(t("chat.streamFailed"));
      }

      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const lines = frame.split("\n");
          let eventType = "message";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
          }

          if (eventType === "part" && dataStr) {
            try {
              const payload = JSON.parse(dataStr);
              if (payload.kind === "text" && payload.text) {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantMessageId) return msg;
                    const prevText = parseText(msg.contentJson);
                    const nextText = prevText + payload.text;
                    return {
                      ...msg,
                      contentJson: JSON.stringify({ parts: [{ kind: "text", text: nextText }] }),
                    };
                  })
                );
              }
            } catch {}
          } else if (eventType === "done") {
            setIsStreaming(false);
            setActiveGenId(null);
            await refreshChat(activeId, assistantMessageId);
            return;
          } else if (eventType === "error") {
            setIsStreaming(false);
            setActiveGenId(null);
            try {
              const errPayload = JSON.parse(dataStr);
              const mapped = mapProviderError(t, errPayload.code, errPayload.message);
              setErrorState({ ...mapped, assistantId: assistantMessageId });
            } catch {
              setErrorState({ message: t("chat.generationFailed"), retryable: true, assistantId: assistantMessageId });
            }
            await refreshChat(activeId, assistantMessageId);
            return;
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("chat.receiveFailed");
      const mapped = mapProviderError(t, undefined, msg);
      setErrorState({ ...mapped, assistantId: assistantMessageId });
    } finally {
      setIsStreaming(false);
      setActiveGenId(null);
      await refreshChat(activeId, assistantMessageId);
    }
  }

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;

    const userText = input.trim();
    const sending = attachments;
    const searchOn = webSearchOn;
    setInput("");
    setAttachments([]);
    setErrorState(null);

    try {
      const activeId = await ensureChat();
      const parentId = activeLeafId;

      const sendRes = await fetch(`/api/kawan/v1/chat/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: userText || "(gambar)",
          parentId,
          attachments: sending,
          ...(searchOn ? { webSearch: true } : {}),
        }),
      });

      if (!sendRes.ok) {
        const err = await sendRes.json().catch(() => ({}));
        throw new Error(err.message || t("chat.sendFailed"));
      }

      const { generationId, assistantMessageId, userMessageId } = await sendRes.json();

      // Optimistic append
      const userNode: TreeNode = {
        id: userMessageId,
        chatId: activeId,
        parentId,
        role: "user",
        seq: messages.length + 1,
        status: "complete",
        contentJson: JSON.stringify({
          parts: [
            { kind: "text", text: userText || "(gambar)" },
            ...(searchOn ? [{ kind: "web-search" }] : []),
            ...sending,
          ],
        }),
      };
      const assistantNode: TreeNode = {
        id: assistantMessageId,
        chatId: activeId,
        parentId: userMessageId,
        role: "assistant",
        seq: messages.length + 2,
        status: "streaming",
        contentJson: JSON.stringify({ parts: [{ kind: "text", text: "" }] }),
      };

      setMessages((prev) => [...prev, userNode, assistantNode]);
      setActiveLeafId(assistantMessageId);

      await streamSSE(activeId, generationId, assistantMessageId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("chat.sendError");
      setErrorState({ message: msg, retryable: false });
      setIsStreaming(false);
      setActiveGenId(null);
    }
  }

  async function handleStop() {
    if (!chatId || !activeGenId) return;
    try {
      await fetch(`/api/kawan/v1/chat/${chatId}/generations/${activeGenId}/stop`, {
        method: "POST",
      });
      setIsStreaming(false);
      setActiveGenId(null);
    } catch {}
  }

  async function handleCopy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setCopyError(false);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard ditolak: pengguna diberi tahu, isi pesan tidak disiarkan.
      setCopyError(true);
      setTimeout(() => setCopyError(false), 3000);
    }
  }

  async function handleRegenerate(messageId: string) {
    if (!chatId || isStreaming) return;
    setErrorState(null);
    try {
      const res = await fetch(`/api/kawan/v1/chat/${chatId}/messages/${messageId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || t("chat.regenerateFailed"));
      }

      const { generationId, assistantMessageId } = await res.json();
      await refreshChat(chatId, assistantMessageId);
      await streamSSE(chatId, generationId, assistantMessageId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("chat.regenerateFailedShort");
      const mapped = mapProviderError(t, undefined, msg);
      setErrorState({ ...mapped, assistantId: messageId });
    }
  }

  async function handleEditSubmit(messageId: string) {
    if (!chatId || !editText.trim() || isStreaming) return;
    setErrorState(null);
    const content = editText.trim();
    try {
      const res = await fetch(`/api/kawan/v1/chat/${chatId}/messages/${messageId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, mode: "branch" }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || t("chat.editFailed"));
      }

      setEditingId(null);
      setEditText("");

      const data = await res.json();
      const { generationId, assistantMessageId, currentMessageId } = data;
      await refreshChat(chatId, currentMessageId || assistantMessageId);

      if (generationId && assistantMessageId) {
        await streamSSE(chatId, generationId, assistantMessageId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("chat.editFailed");
      setErrorState({ message: msg, retryable: false });
    }
  }

  async function handleOpenCitation(messageId: string, chunkId: string) {
    setOpenCitation({ messageId, chunkId, text: null });
    try {
      const res = await fetch(`/api/kawan/v1/documents/chunks/${chunkId}`);
      const data = res.ok ? await res.json() : null;
      setOpenCitation({
        messageId,
        chunkId,
        text: typeof data?.text === "string" ? data.text : t("chat.chunkUnavailable"),
      });
    } catch {
      setOpenCitation({ messageId, chunkId, text: t("chat.chunkUnavailable") });
    }
  }

  function handleSwitchBranch(targetSiblingId: string) {
    const leaf = findLeaf(messages, targetSiblingId);
    setActiveLeafId(leaf);
  }

  // Kontrol media (WP-NT-P8-01/03/04). Kegagalannya jadi pesan di area galat,
  // bukan `alert`, dan tidak menyentuh jalur streaming.
  async function handleImage(prompt: string) {
    if (!prompt.trim()) return;
    setMediaBusy(true);
    setErrorState(null);
    try {
      const res = await fetch("/api/kawan/v1/media/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.image !== "string") {
        throw new Error(data?.error?.message || t("chat.imageFailed"));
      }
      setAttachments((prev) =>
        [...prev, { mime: "image/png", dataUrl: data.image }].slice(0, MAX_IMAGES),
      );
    } catch (err: unknown) {
      setErrorState({
        message: err instanceof Error ? err.message : t("chat.imageFailed"),
        retryable: false,
      });
    } finally {
      setMediaBusy(false);
    }
  }

  async function handleTranscribe(file: File) {
    setMediaBusy(true);
    setErrorState(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/kawan/v1/media/transcribe", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.text !== "string") {
        throw new Error(data?.error?.message || t("chat.transcribeFailed"));
      }
      const text: string = data.text;
      setInput((prev) => (prev.trim() ? `${prev} ${text}` : text));
    } catch (err: unknown) {
      setErrorState({
        message: err instanceof Error ? err.message : t("chat.transcribeFailed"),
        retryable: false,
      });
    } finally {
      setMediaBusy(false);
    }
  }

  async function handleSpeak() {
    let path: TreeNode[] = messages;
    try {
      if (activeLeafId) path = buildAncestryPath(messages, activeLeafId);
    } catch {}
    const last = [...path]
      .reverse()
      .find((m) => m.role === "assistant" && parseText(m.contentJson).trim() !== "");
    const text = last ? parseText(last.contentJson) : "";
    if (!text.trim()) return;

    setMediaBusy(true);
    setErrorState(null);
    try {
      const res = await fetch("/api/kawan/v1/media/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || t("chat.speakFailed"));
      }
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play().catch(() => URL.revokeObjectURL(url));
    } catch (err: unknown) {
      setErrorState({
        message: err instanceof Error ? err.message : t("chat.speakFailed"),
        retryable: false,
      });
    } finally {
      setMediaBusy(false);
    }
  }

  // Active ancestry path
  let activeMessages: TreeNode[] = [];
  try {
    if (messages.length > 0) {
      activeMessages = activeLeafId ? buildAncestryPath(messages, activeLeafId) : messages;
    }
  } catch {
    activeMessages = messages;
  }

  return (
    <div className="flex flex-1 flex-col h-[calc(100dvh-5rem)] max-w-4xl w-full mx-auto p-4">
      {/* Area Pesan */}
      {/* Pesan baru diumumkan pembaca layar tanpa memindahkan fokus (WCAG 4.1.3). */}
      <div role="log" aria-live="polite" aria-relevant="additions" className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4">
        {activeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
            <h2 className="text-2xl font-semibold mb-2">{t("chat.emptyTitle")}</h2>
            <p className="text-sm max-w-md">{t("chat.emptyBody")}</p>
          </div>
        ) : (
          activeMessages.map((m) => {
            const text = parseText(m.contentJson);
            const images = parseImages(m.contentJson);
            const note = parseNote(m.contentJson);
            const citations = parseCitations(m.contentJson);
            const sources = parseSources(m.contentJson);
            const siblings = siblingsOf(messages, m.id);
            const sibIdx = siblings.findIndex((s) => s.id === m.id);
            const hasSiblings = siblings.length > 1;
            const isEditing = editingId === m.id;

            return (
              <div
                key={m.id}
                className={`group flex flex-col ${
                  m.role === "user" ? "items-end" : "items-start"
                }`}
              >
                {note === "keyword-only" && !isEditing && (
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t("chat.keywordOnly")}
                  </p>
                )}
                {note === "web-search-unavailable" && !isEditing && (
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t("chat.webSearchUnavailable")}
                  </p>
                )}
                {isEditing ? (
                  <div className="w-full max-w-[85%] rounded-2xl border bg-background p-3 shadow-xs space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full resize-none bg-transparent p-1 text-sm outline-none min-h-[72px]"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditText("");
                        }}
                      >
                        <X className="size-3.5 mr-1" />
                        {t("common.cancel")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleEditSubmit(m.id)}
                        disabled={!editText.trim() || isStreaming}
                      >
                        {t("chat.saveBranch")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted border border-border text-foreground"
                    }`}
                  >
                    {images.length > 0 && (
                      <ul className="mb-2 flex flex-wrap gap-2">
                        {images.map((image, index) => (
                          <li key={`${image.mime}-${index}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- data URL attachment, not an optimizable asset */}
                            <img
                              src={image.dataUrl}
                              alt={t("chat.attachmentAlt", { index: index + 1 })}
                              className="max-h-56 rounded-lg border object-contain"
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    {text ? (
                      m.role === "assistant" ? (
                        <Markdown text={text} />
                      ) : (
                        <p className="whitespace-pre-wrap">{text}</p>
                      )
                    ) : images.length > 0 ? null : m.status === "streaming" ? (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground italic">
                        <span className="size-2 rounded-full bg-primary animate-pulse" />
                        {t("chat.thinking")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">{t("chat.noReply")}</span>
                    )}
                  </div>
                )}

                {m.role === "assistant" && citations.length > 0 && !isEditing && (
                  <div className="mt-1 flex flex-wrap items-center gap-1 px-1">
                    {citations.map((citation) => (
                      <button
                        key={citation.chunkId}
                        type="button"
                        aria-label={
                          citation.page === null
                            ? t("chat.viewChunk", { filename: citation.filename })
                            : t("chat.viewChunkPage", { filename: citation.filename, page: citation.page })
                        }
                        aria-expanded={
                          openCitation?.messageId === m.id &&
                          openCitation.chunkId === citation.chunkId
                        }
                        onClick={() => handleOpenCitation(m.id, citation.chunkId)}
                        className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        [{citation.index}]
                      </button>
                    ))}
                  </div>
                )}

                {m.role === "assistant" && !isEditing && <SourceList sources={sources} />}

                {m.role === "assistant" &&
                  openCitation?.messageId === m.id &&
                  !isEditing && (
                    <div className="mt-1 max-w-[85%] rounded-lg border bg-background p-2 text-xs text-muted-foreground">
                      {openCitation.text === null
                        ? t("chat.loadingChunk")
                        : openCitation.text}
                    </div>
                  )}

                {/* Sibling navigation & Action buttons */}
                {!isEditing && (
                  <div
                    className={`flex items-center gap-2 mt-1 px-1 text-xs text-muted-foreground ${
                      m.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {hasSiblings && (
                      <div className="inline-flex items-center gap-1 bg-muted/60 rounded-md px-1.5 py-0.5 border text-[11px]">
                        <button
                          type="button"
                          aria-label={t("chat.prevBranch")}
                          disabled={sibIdx <= 0 || isStreaming}
                          onClick={() => handleSwitchBranch(siblings[sibIdx - 1].id)}
                          className="hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="size-3" />
                        </button>
                        <span>
                          {sibIdx + 1} / {siblings.length}
                        </span>
                        <button
                          type="button"
                          aria-label={t("chat.nextBranch")}
                          disabled={sibIdx >= siblings.length - 1 || isStreaming}
                          onClick={() => handleSwitchBranch(siblings[sibIdx + 1].id)}
                          className="hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="size-3" />
                        </button>
                      </div>
                    )}

                    {text && (
                      <button
                        type="button"
                        aria-label={t("chat.copyMessage")}
                        onClick={() => handleCopy(m.id, text)}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 hover:text-foreground focus-visible:opacity-100"
                        title={t("chat.copy")}
                      >
                        {copiedId === m.id ? (
                          <Check className="size-3.5 text-green-600" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    )}

                    {m.role === "user" && (
                      <button
                        type="button"
                        aria-label={t("chat.editMessage")}
                        disabled={isStreaming}
                        onClick={() => {
                          setEditingId(m.id);
                          setEditText(text);
                        }}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 hover:text-foreground focus-visible:opacity-100 disabled:opacity-0"
                        title={t("chat.editMessage")}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}

                    {m.role === "assistant" && (
                      <button
                        type="button"
                        aria-label={t("chat.regenerate")}
                        disabled={isStreaming}
                        onClick={() => handleRegenerate(m.id)}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 hover:text-foreground focus-visible:opacity-100 disabled:opacity-0"
                        title={t("chat.regenerate")}
                      >
                        <RotateCcw className="size-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {copyError && (
        <p role="status" aria-live="polite" className="mb-2 text-xs text-destructive">
          {t("chat.copyFailed")}
        </p>
      )}

      {errorState && (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 flex items-center justify-between gap-2 p-3 text-sm rounded-lg bg-destructive/10 text-destructive border border-destructive/20"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorState.message}</span>
          </div>
          {errorState.retryable && errorState.assistantId && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-destructive/30 hover:bg-destructive/10 text-destructive"
              onClick={() => {
                const id = errorState.assistantId!;
                setErrorState(null);
                handleRegenerate(id);
              }}
            >
              <RotateCcw className="size-3 mr-1" />
              {t("common.retry")}
            </Button>
          )}
        </div>
      )}

      {/* Dokumen (WP-NT-P6-10) */}
      <div className="mt-auto pt-2">
        <DocumentsPanel />
      </div>

      {/* Input Composer */}
      <form onSubmit={handleSend} className="relative pt-2">
        {attachments.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <li key={`${file.mime}-${index}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not an optimizable asset */}
                <img
                  src={file.dataUrl}
                  alt={t("chat.attachmentAlt", { index: index + 1 })}
                  className="size-16 rounded-lg border object-cover"
                />
                <button
                  type="button"
                  aria-label={t("chat.removeAttachment", { index: index + 1 })}
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                  className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {/* Prompt tersimpan (WP-NT-P7-04/05) */}
        <div className="mb-1 flex items-center">
          <PromptPicker onApply={(body) => setInput(applyVariables(body, { isi: input }))} />
        </div>
        <div className="relative flex items-center rounded-2xl border bg-background shadow-xs focus-within:ring-2 focus-within:ring-ring">
          {webSearchAvailable && (
            <button
              type="button"
              aria-pressed={webSearchOn}
              aria-label={t("chat.webSearch")}
              title={t("chat.webSearch")}
              onClick={() => setWebSearchOn((prev) => !prev)}
              disabled={isStreaming}
              className={`ml-2 rounded-lg p-2 disabled:opacity-50 ${
                webSearchOn ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="size-4" />
            </button>
          )}
          {/* Kontrol media hanya dirender bila server mengumumkan fiturnya;
              handler pun hanya diisi untuk fitur yang tersedia (REQ-NT-69). */}
          {(mediaCaps.imageGen || mediaCaps.stt || mediaCaps.tts) && (
            <MediaControls
              busy={isStreaming || mediaBusy}
              prompt={input}
              {...(mediaCaps.imageGen ? { onImage: handleImage } : {})}
              {...(mediaCaps.stt ? { onTranscribe: handleTranscribe } : {})}
              {...(mediaCaps.tts ? { onSpeak: handleSpeak } : {})}
            />
          )}
          {vision && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={IMAGE_MIMES.join(",")}
                multiple
                className="sr-only"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  const picked: { mime: string; dataUrl: string }[] = [];
                  for (const file of files) {
                    if (!(IMAGE_MIMES as readonly string[]).includes(file.type)) continue;
                    if (file.size > MAX_IMAGE_BYTES) {
                      setErrorState({ message: t("chat.imageTooLarge"), retryable: false });
                      continue;
                    }
                    const dataUrl = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(String(reader.result));
                      reader.onerror = () => reject(reader.error);
                      reader.readAsDataURL(file);
                    }).catch(() => "");
                    if (dataUrl) picked.push({ mime: file.type, dataUrl });
                  }
                  setAttachments((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
                }}
              />
              <button
                type="button"
                aria-label={t("chat.attachImage")}
                title={t("chat.attachImage")}
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming}
                className="ml-2 rounded-lg p-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <ImagePlus className="size-4" />
              </button>
            </>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter during IME composition (Japanese/Chinese/Vietnamese input) must not send.
              if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
              // `sendOnEnter` menentukan arah: false berarti Shift+Enter yang mengirim.
              if (e.shiftKey !== sendOnEnter) {
                e.preventDefault();
                handleSend();
              }
            }}
            aria-label={t("chat.composerLabel")}
            placeholder={
              sendOnEnter
                ? t("chat.composerPlaceholderSend")
                : t("chat.composerPlaceholderNewline")
            }
            className="w-full resize-none bg-transparent px-4 py-3.5 text-sm outline-none max-h-36 min-h-[52px]"
            rows={1}
            disabled={isStreaming}
          />
          <div className="flex items-center gap-1.5 pr-2.5">
            {isStreaming ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="size-9 rounded-xl p-0"
                onClick={handleStop}
                title={t("chat.stop")}
                aria-label={t("chat.stop")}
              >
                <Square className="size-4 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                className="size-9 rounded-xl p-0"
                disabled={!input.trim()}
                title={t("chat.send")}
                aria-label={t("chat.send")}
              >
                <Send className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
