"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Square, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  status?: string;
}

export function ChatView() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeGenId, setActiveGenId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function ensureChat(): Promise<string> {
    if (chatId) return chatId;
    const res = await fetch("/api/kawan/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Obrolan Baru" }),
    });
    if (!res.ok) throw new Error("Gagal membuat percakapan");
    const data = await res.json();
    setChatId(data.id);
    return data.id;
  }

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userText = input.trim();
    setInput("");
    setErrorMsg(null);

    const tempUserMsg: MessageItem = {
      id: "u_" + Date.now(),
      role: "user",
      text: userText,
    };
    const tempAssistantMsg: MessageItem = {
      id: "a_" + Date.now(),
      role: "assistant",
      text: "",
      status: "streaming",
    };

    setMessages((prev) => [...prev, tempUserMsg, tempAssistantMsg]);
    setIsStreaming(true);

    try {
      const activeId = await ensureChat();
      const sendRes = await fetch(`/api/kawan/v1/chat/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userText }),
      });

      if (!sendRes.ok) {
        const err = await sendRes.json().catch(() => ({}));
        throw new Error(err.message || "Gagal mengirim pesan");
      }

      const { generationId, assistantMessageId } = await sendRes.json();
      setActiveGenId(generationId);

      // Connect to SSE stream
      const eventSource = new EventSource(
        `/api/kawan/v1/chat/${activeId}/stream?generationId=${generationId}&afterSeq=0`
      );

      eventSource.addEventListener("part", (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.kind === "text" && payload.text) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempAssistantMsg.id
                  ? { ...msg, text: msg.text + payload.text, id: assistantMessageId }
                  : msg
              )
            );
          }
        } catch {}
      });

      eventSource.addEventListener("done", () => {
        setIsStreaming(false);
        setActiveGenId(null);
        eventSource.close();
      });

      eventSource.addEventListener("error", () => {
        setIsStreaming(false);
        setActiveGenId(null);
        eventSource.close();
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat chat";
      setErrorMsg(msg);
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

  return (
    <div className="flex flex-1 flex-col h-[calc(100dvh-5rem)] max-w-4xl w-full mx-auto p-4">
      {/* Area Pesan */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
            <h2 className="text-2xl font-semibold mb-2">Mulai percakapan dengan AI</h2>
            <p className="text-sm max-w-md">Ketik pesanmu di bawah. AI akan membalas menggunakan API gateway yang terhubung.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${
                m.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted border border-border text-foreground"
                }`}
              >
                {m.text ? (
                  <p className="whitespace-pre-wrap">{m.text}</p>
                ) : m.status === "streaming" ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground italic">
                    <span className="size-2 rounded-full bg-primary animate-pulse" />
                    Sedang berpikir...
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">Tidak ada balasan</span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {errorMsg && (
        <div className="mb-3 flex items-center gap-2 p-3 text-sm rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Input Composer */}
      <form onSubmit={handleSend} className="relative mt-auto pt-2">
        <div className="relative flex items-center rounded-2xl border bg-background shadow-xs focus-within:ring-2 focus-within:ring-ring">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Tulis pesan... (Enter untuk kirim, Shift+Enter untuk baris baru)"
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
                title="Hentikan balasan"
              >
                <Square className="size-4 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                className="size-9 rounded-xl p-0"
                disabled={!input.trim()}
                title="Kirim pesan"
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
