"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Markdown } from "./markdown";
import { DocumentAttachButton, DocumentChips, useDocuments } from "./documents-panel";
import { SourceList } from "./source-list";
import { PromptPicker } from "./prompt-picker";
import { MediaControls } from "./media-controls";
import { KawanMascot } from "./kawan-mascot";
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

type ImageRef = { mime: string; dataUrl?: string; artifactId?: string };

/** Sumber gambar: data URL unggahan, atau endpoint artefak untuk hasil buatan. */
function imageSrc(image: ImageRef): string {
  if (image.dataUrl) return image.dataUrl;
  return `/api/kawan/v1/artifacts/${encodeURIComponent(image.artifactId ?? "")}`;
}

function parseImages(contentJson: string): ImageRef[] {
  try {
    const data = JSON.parse(contentJson);
    if (Array.isArray(data?.parts)) {
      // FIX-16: gambar hasil pembuatan hanya membawa artifactId, bukan base64.
      return data.parts.filter(
        (p: ImageRef & { kind?: string }) =>
          p?.kind === "image" &&
          (typeof p.dataUrl === "string" || typeof p.artifactId === "string"),
      );
    }
  } catch {}
  return [];
}

function parseNotes(contentJson: string): string[] {
  try {
    const data = JSON.parse(contentJson);
    if (!Array.isArray(data?.parts)) return [];
    return data.parts
      .filter((p: { kind?: string; code?: string }) => p?.kind === "note" && typeof p.code === "string")
      .map((p: { code: string }) => p.code);
  } catch {}
  return [];
}

type ArtifactView = {
  artifactId: string;
  displayName: string;
  format: string;
  sizeBytes: number;
};

function parseArtifacts(contentJson: string): ArtifactView[] {
  try {
    const data = JSON.parse(contentJson);
    if (!Array.isArray(data?.parts)) return [];
    return data.parts.filter(
      (p: { kind?: string; artifactId?: string }) =>
        p?.kind === "artifact" && typeof p?.artifactId === "string",
    ) as ArtifactView[];
  } catch {}
  return [];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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

/** Kunci draft per chat di sessionStorage; selamat dari reload. */
function draftKey(id: string): string {
  return `kawan:draft:${id}`;
}

/** Draft dari sesi sebelumnya; sessionStorage bisa diblokir (mode privat). */
function readDraft(id: string): string {
  try {
    return sessionStorage.getItem(draftKey(id)) ?? "";
  } catch {
    return "";
  }
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
  // Progres yang terlihat (bukan animasi): fase nyata dari server, mis.
  // "Mencari di web", "Membaca 2 halaman sumber", "Menjalankan 1 tool".
  const [phases, setPhases] = useState<{ phase: string; label: string }[]>([]);
  // UX-1: indikator pemuatan saat pindah chat, supaya layar tidak terlihat
  // seperti chat kosong sebelum riwayatnya tiba.
  const [loadingChat, setLoadingChat] = useState(false);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  // Preferensi Enter (REQ-NT-70). Bawaan `true` = perilaku lama sampai
  // pengaturan termuat; gagal fetch tidak boleh mematikan tombol kirim.
  const [sendOnEnter, setSendOnEnter] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const documentsApi = useDocuments();
  // FIX-16: hasil image generation disimpan sebagai artefak; lampiran hanya
  // membawa id + URL unduhan, bukan base64.
  const [attachments, setAttachments] = useState<ImageRef[]>([]);
  const [modelRef, setModelRef] = useState<string | null>(null);
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
  // FIX-03: action ID dibuat sekali per kiriman lalu dipakai ulang saat retry,
  // supaya server mengenali kiriman ganda sebagai satu action yang sama.
  const actionIdRef = useRef<string | null>(null);
  // Penjaga sinkron: `isStreaming` baru berubah setelah render, jadi klik
  // kedua dalam frame yang sama masih lolos tanpa ini.
  const sendingRef = useRef(false);
  // Stream dibatalkan saat chat berganti; delta chat lama tidak boleh masuk.
  const streamAbortRef = useRef<AbortController | null>(null);
  // FIX-16: pemutaran TTS dapat dibatalkan; URL objek tidak boleh menggantung.
  const speechUrlRef = useRef<string | null>(null);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  // true selama audio TTS diputar; tombol berubah jadi "hentikan".
  const [speaking, setSpeaking] = useState(false);
  const chatIdRef = useRef<string | null>(chatId);
  // Draft per chat: pindah chat tidak boleh membuang ketikan.
  const draftsRef = useRef<Map<string, string>>(new Map());
  // Nilai `input` terbaru tanpa menjadikannya dependensi efek reset.
  const inputRef = useRef("");
  inputRef.current = input;

  // Tombol lampiran hanya muncul bila model yang dipakai chat ini mengumumkan visi
  // (REQ-NT-46: model tanpa visi tidak menampilkan tombol, bukan tombol mati).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/kawan/v1/models")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !Array.isArray(data?.models)) return;
        // Chat baru belum punya modelRef; untuk tombol visi pakai model pertama
        // yang dilaporkan server. Nilai ini TIDAK disimpan: menyimpannya berarti
        // diam-diam mengunci chat ke model tertentu (FIX-04).
        const id: string | null =
          modelRef ?? (typeof data.models[0]?.id === "string" ? data.models[0].id : null);
        const model = data.models.find((m: { id?: string }) => m.id === id);
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
    setLoadingChat(true);
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
    setLoadingChat(false);
  }, []);

  // FIX-03: pindah chat membatalkan stream lama, membuang action ID lama, dan
  // memulihkan draft chat tujuan. Tanpa ini delta chat lama bisa menempel ke
  // chat baru dan ketikan yang belum terkirim hilang.
  useEffect(() => {
    const prev = chatIdRef.current;
    if (prev === chatId) return;
    if (prev) draftsRef.current.set(prev, inputRef.current);
    // Simpan ke sessionStorage supaya draft juga selamat dari reload.
    try {
      if (prev) {
        const text = inputRef.current;
        if (text) sessionStorage.setItem(draftKey(prev), text);
        else sessionStorage.removeItem(draftKey(prev));
      }
    } catch {}
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    sendingRef.current = false;
    actionIdRef.current = null;
    setIsStreaming(false);
    setActiveGenId(null);
    setErrorState(null);
    setMessages([]);
    setActiveLeafId(null);
    setInput(chatId ? draftsRef.current.get(chatId) ?? readDraft(chatId) : "");
    chatIdRef.current = chatId;
    // `input` dibaca lewat ref: efek ini hanya boleh jalan saat chat berganti.
  }, [chatId]);

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
      // Judul tidak dikirim: chat baru harus tercatat `titleSource: "auto"`
      // supaya judul otomatis bisa mengisinya (FIX-04). Model hanya dikirim
      // bila chat ini memang sudah punya pilihan; selebihnya server yang
      // menentukan dan melaporkan fallback-nya.
      body: JSON.stringify(modelRef ? { modelRef } : {}),
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
    // Fase dari generasi sebelumnya tidak boleh menempel ke jawaban baru.
    setPhases([]);
    setActiveGenId(generationId);
    setErrorState(null);

    const controller = new AbortController();
    streamAbortRef.current?.abort();
    streamAbortRef.current = controller;
    // Cursor = seq terakhir yang sudah diterapkan. Delta dengan seq <= cursor
    // dibuang, jadi sambung-ulang tidak menggandakan teks.
    let cursor = 0;
    let attempt = 0;

    try {
      while (true) {
        const streamRes = await fetch(
          `/api/kawan/v1/chat/${activeId}/stream?generationId=${generationId}&afterSeq=${cursor}`,
          { headers: { Accept: "text/event-stream" }, signal: controller.signal }
        );

        if (!streamRes.ok || !streamRes.body) {
          throw new Error(t("chat.streamFailed"));
        }

        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let finished = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // Chat berganti saat stream berjalan: hentikan, jangan tulis ke chat baru.
          if (chatIdRef.current !== activeId) {
            await reader.cancel().catch(() => {});
            return;
          }
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
                const seq = typeof payload.seq === "number" ? payload.seq : null;
                if (seq !== null) {
                  if (seq <= cursor) continue;
                  cursor = seq;
                }
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
            } else if (eventType === "phase" && dataStr) {
              try {
                const payload = JSON.parse(dataStr) as { phase?: string; label?: string };
                if (typeof payload.phase === "string" && typeof payload.label === "string") {
                  setPhases((prev) => [...prev, { phase: payload.phase!, label: payload.label! }]);
                }
              } catch {}
            } else if (eventType === "done") {
              finished = true;
              break;
            } else if (eventType === "error") {
              finished = true;
              try {
                const errPayload = JSON.parse(dataStr);
                const mapped = mapProviderError(t, errPayload.code, errPayload.message);
                setErrorState({ ...mapped, assistantId: assistantMessageId });
              } catch {
                setErrorState({ message: t("chat.generationFailed"), retryable: true, assistantId: assistantMessageId });
              }
              break;
            }
          }
          if (finished) break;
        }

        if (finished) return;
        // Server menutup stream tanpa `done`: sambung ulang dari cursor, dengan
        // backoff supaya tidak membanjiri server saat koneksi benar-benar mati.
        attempt += 1;
        if (attempt > 5) throw new Error(t("chat.streamFailed"));
        await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** (attempt - 1), 8000)));
        if (controller.signal.aborted) return;
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : t("chat.receiveFailed");
      const mapped = mapProviderError(t, undefined, msg);
      setErrorState({ ...mapped, assistantId: assistantMessageId });
    } finally {
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
      if (chatIdRef.current === activeId) {
        setIsStreaming(false);
        setActiveGenId(null);
        await refreshChat(activeId, assistantMessageId);
      }
    }
  }

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    // `sendingRef` menutup celah antara klik dan render `isStreaming`: dua klik
    // dalam satu frame tetap menghasilkan satu job.
    if ((!input.trim() && attachments.length === 0) || isStreaming || sendingRef.current) return;

    const userText = input.trim();
    const sending = attachments;
    const searchOn = webSearchOn;
    setInput("");
    setAttachments([]);
    setErrorState(null);
    sendingRef.current = true;

    try {
      const activeId = await ensureChat();
      const parentId = activeLeafId;

      // Action ID stabil: dipakai ulang bila kiriman ini diulang setelah galat,
      // supaya server mengenalinya sebagai action yang sama (bukan job baru).
      if (!actionIdRef.current) {
        actionIdRef.current =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }

      // FIX-16: kirim rujukan artefak, bukan data URL base64. Unggahan biasa
      // tetap membawa dataUrl; hasil pembuatan membawa artifactId.
      const wireAttachments = sending.map((image) =>
        image.artifactId
          ? { mime: image.mime, artifactId: image.artifactId }
          : { mime: image.mime, dataUrl: image.dataUrl },
      );

      const sendRes = await fetch(`/api/kawan/v1/chat/${activeId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": actionIdRef.current,
        },
        body: JSON.stringify({
          content: userText || "(gambar)",
          parentId,
          attachments: wireAttachments,
          ...(documentsApi.selectedIds.length > 0 ? { documentIds: documentsApi.selectedIds } : {}),
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
      void wireAttachments;
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

      // Kiriman diterima server: action berikutnya harus punya kunci sendiri.
      actionIdRef.current = null;
      sendingRef.current = false;

      await streamSSE(activeId, generationId, assistantMessageId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("chat.sendError");
      // Kunci TIDAK dibuang: percobaan ulang kiriman ini harus memakai kunci
      // yang sama agar tidak membuat job kedua.
      setErrorState({ message: msg, retryable: false });
      sendingRef.current = false;
      setIsStreaming(false);
      setActiveGenId(null);
    }
  }

  async function handleStop() {
    if (!chatId || !activeGenId) return;
    streamAbortRef.current?.abort();
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

  /** Cabut URL objek yang sedang diputar; aman dipanggil berkali-kali. */
  function stopSpeech() {
    const url = speechUrlRef.current;
    speechUrlRef.current = null;
    if (url) URL.revokeObjectURL(url);
    speechAudioRef.current?.pause();
    speechAudioRef.current = null;
    setSpeaking(false);
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
      // FIX-16: URL objek dilacak supaya bisa dicabut saat dibatalkan, bukan
      // hanya saat pemutaran selesai (kalau tidak, blob menggantung).
      stopSpeech();
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      speechUrlRef.current = url;
      speechAudioRef.current = audio;
      audio.onended = stopSpeech;
      setSpeaking(true);
      await audio.play().catch(() => stopSpeech());
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
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col max-sm:px-0 p-4">
      {/* Area Pesan */}
      {/* Pesan baru diumumkan pembaca layar tanpa memindahkan fokus (WCAG 4.1.3). */}
      <div role="log" aria-live="polite" aria-relevant="additions" className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4">
        {activeMessages.length === 0 ? (
          loadingChat && messages.length === 0 ? (
            <div className="space-y-3" aria-hidden data-testid="chat-loading-skeleton">
              <div className="h-16 w-3/5 animate-pulse rounded-2xl bg-muted/60" />
              <div className="ml-auto h-10 w-2/5 animate-pulse rounded-2xl bg-primary/20" />
              <div className="h-24 w-4/5 animate-pulse rounded-2xl bg-muted/60" />
            </div>
          ) : (
<div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
              <KawanMascot mood="idle" size={72} className="mb-3" />
              <h2 className="text-2xl font-semibold mb-2">{t("chat.emptyTitle")}</h2>
              <p className="text-sm max-w-md">{t("chat.emptyBody")}</p>
            </div>
          )
        ) : (
          activeMessages.map((m) => {
            const text = parseText(m.contentJson);
            const images = parseImages(m.contentJson);
            const notes = parseNotes(m.contentJson);
            const artifacts = parseArtifacts(m.contentJson);
            const citations = parseCitations(m.contentJson);
            const sources = parseSources(m.contentJson);
            const siblings = siblingsOf(messages, m.id);
            const sibIdx = siblings.findIndex((s) => s.id === m.id);
            const hasSiblings = siblings.length > 1;
            const isEditing = editingId === m.id;

            return (
              <div
                key={m.id}
                className={`group flex min-w-0 flex-col ${
                  m.role === "user" ? "items-end" : "items-start"
                }`}
              >
                {notes.includes("keyword-only") && !isEditing && (
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t("chat.keywordOnly")}
                  </p>
                )}
                {notes.includes("web-search-unavailable") && !isEditing && (
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t("chat.webSearchUnavailable")}
                  </p>
                )}
                {notes.includes("history-trimmed") && !isEditing && (
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t("chat.historyTrimmed")}
                  </p>
                )}
                {notes.includes("truncated") && !isEditing && (
                  <p className="mb-1 text-xs text-muted-foreground">{t("chat.truncated")}</p>
                )}
                {notes.includes("file-failed") && !isEditing && (
                  <p className="mb-1 text-xs text-muted-foreground">{t("chat.fileFailed")}</p>
                )}
                {/* R5: dokumen yang dipotong/di-skip harus terlihat pengguna. */}
                {notes.includes("doc-truncated") && !isEditing && (
                  <p className="mb-1 text-xs text-muted-foreground">{t("chat.docTruncated")}</p>
                )}
                {notes.includes("doc-blocks-skipped") && !isEditing && (
                  <p className="mb-1 text-xs text-muted-foreground">{t("chat.docBlocksSkipped")}</p>
                )}
                {artifacts.length > 0 && !isEditing && (
                  <ul className="mb-1 space-y-1">
                    {artifacts.map((a) => (
                      <li key={a.artifactId}>
                        <a
                          href={`/api/kawan/v1/artifacts/${encodeURIComponent(a.artifactId)}`}
                          download={a.displayName}
                          className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs shadow-xs hover:bg-accent"
                        >
                          <span className="font-medium">{a.displayName}</span>
                          <span className="text-muted-foreground">
                            {a.format.toUpperCase()} · {formatBytes(a.sizeBytes)}
                          </span>
                          <span className="text-primary">{t("chat.artifactDownload")}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {isEditing ? (
                  <div className="w-full min-w-0 max-w-[85%] rounded-2xl border bg-background p-3 shadow-xs space-y-2">
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
                    className={`min-w-0 max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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
                              src={imageSrc(image)}
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
                        <p className="whitespace-pre-wrap break-words">{text}</p>
                      )
                    ) : images.length > 0 ? null : m.status === "streaming" ? (
                      // Progres nyata: label fase terakhir dari server. Bila belum
                      // ada fase (mis. tepat setelah kirim), jatuh ke "berpikir".
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground italic">
                        <KawanMascot mood="thinking" size={18} />
                        {phases.length > 0 ? phases[phases.length - 1]!.label : t("chat.thinking")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">{t("chat.noReply")}</span>
                    )}
                    {m.status === "streaming" && phases.length > 0 && (
                      <div
                        className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"
                        data-testid="stream-phase"
                      >
                        <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                        {phases[phases.length - 1]!.label}
                      </div>
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
                    <div className="relative mt-1 max-h-64 max-w-[85%] overflow-y-auto whitespace-pre-wrap rounded-lg border bg-background p-2 pr-8 text-xs text-muted-foreground">
                      {openCitation.text === null ? t("chat.loadingChunk") : openCitation.text}
                      <button
                        type="button"
                        aria-label={t("chat.closeCitation")}
                        onClick={() => setOpenCitation(null)}
                        className="absolute right-1 top-1 inline-flex min-h-8 min-w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-4" />
                      </button>
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
                          className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="size-5" />
                        </button>
                        <span>
                          {sibIdx + 1} / {siblings.length}
                        </span>
                        <button
                          type="button"
                          aria-label={t("chat.nextBranch")}
                          disabled={sibIdx >= siblings.length - 1 || isStreaming}
                          onClick={() => handleSwitchBranch(siblings[sibIdx + 1].id)}
                          className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="size-5" />
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

      {/* Input Composer */}
      <form onSubmit={handleSend} className="relative pt-2">
        {attachments.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <li key={`${file.mime}-${index}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not an optimizable asset */}
                <img
                  src={imageSrc(file)}
                  alt={t("chat.attachmentAlt", { index: index + 1 })}
                  className="size-16 rounded-lg border object-cover"
                />
                <button
                  type="button"
                  aria-label={t("chat.removeAttachment", { index: index + 1 })}
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                  className="absolute -right-1.5 -top-1.5 flex min-h-8 min-w-8 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {/* Prompt tersimpan (WP-NT-P7-04/05) */}
        <div className="mb-1 flex items-center">
          <PromptPicker onApply={(body) => setInput(applyVariables(body, { isi: input }))} />
        </div>
        <div className="relative rounded-2xl border bg-background shadow-xs focus-within:ring-2 focus-within:ring-ring">
          {/* Dokumen (WP-NT-P6-10): chip di dalam kotak, seperti ChatGPT/Gemini. */}
          <DocumentChips api={documentsApi} />
          <div className="flex flex-col sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-1 pb-1 pl-2 pt-1 sm:contents">
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
              speaking={speaking}
              {...(mediaCaps.imageGen ? { onImage: handleImage } : {})}
              {...(mediaCaps.stt ? { onTranscribe: handleTranscribe } : {})}
              {...(mediaCaps.tts ? { onSpeak: handleSpeak, onStopSpeak: stopSpeech } : {})}
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
                  const picked: ImageRef[] = [];
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
            <DocumentAttachButton api={documentsApi} />
            </div>
          <div className="flex items-end">
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
          />
          <div className="flex items-center gap-1.5 pb-2 pr-2.5">
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
                disabled={!input.trim() && attachments.length === 0}
                title={t("chat.send")}
                aria-label={t("chat.send")}
              >
                <Send className="size-4" />
              </Button>
            )}
          </div>
          </div>
          </div>
        </div>
      </form>
    </div>
  );
}