"use client";

import { memo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";

// Raw HTML is never enabled (no rehype-raw), so model output cannot inject markup:
// `<script>` and `onerror` stay inert text. Sanitising is the parser's default, not a plugin.
const REMARK = [remarkGfm, remarkMath];
const REHYPE = [rehypeKatex, rehypeHighlight];

function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  const el = node as { value?: string; children?: unknown; props?: { children?: unknown } };
  if (typeof el.value === "string") return el.value;
  return textOf(el.props?.children ?? el.children);
}

function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;
    // Dynamic import keeps mermaid (~500 KB) out of the first chat paint.
    import("mermaid")
      .then(async (mod) => {
        const mermaid = mod.default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: document.documentElement.classList.contains("dark") ? "dark" : "default",
        });
        const { svg: rendered } = await mermaid.render(idRef.current, code);
        if (!cancelled) setSvg(rendered);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (failed || !svg) {
    return (
      <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
        <code>{code}</code>
      </pre>
    );
  }
  // securityLevel "strict" makes mermaid sanitise its own output.
  return <div className="my-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function CopyButton({ text }: { text: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <>
      <button
        type="button"
        aria-label={status === "copied" ? "Tersalin" : "Salin kode"}
        title="Salin kode"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setStatus("copied");
          } catch {
            // Clipboard ditolak: beri tahu tanpa menyiarkan isi blok kode.
            setStatus("failed");
          }
          setTimeout(() => setStatus("idle"), 1500);
        }}
        className="absolute right-2 top-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border bg-background/80 p-1.5 text-muted-foreground hover:text-foreground"
      >
        {status === "copied" ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {status === "copied" ? "Kode disalin." : status === "failed" ? "Salin gagal; pilih kode manual." : ""}
      </span>
    </>
  );
}

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const code = textOf(children);
  const lang = /language-(\w+)/.exec(className ?? "")?.[1];
  if (lang === "mermaid") return <MermaidDiagram code={code.replace(/\n$/, "")} />;
  return (
    <div className="relative my-2">
      <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
        <code className={className}>{children}</code>
      </pre>
      <CopyButton text={code.replace(/\n$/, "")} />
    </div>
  );
}

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="kawan-markdown text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={REMARK}
        rehypePlugins={REHYPE}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) =>
            className ? (
              <CodeBlock className={className}>{children}</CodeBlock>
            ) : (
              <code className="rounded bg-muted px-1 py-0.5 text-[0.9em]">{children}</code>
            ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline underline-offset-2"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border px-2 py-1 text-left font-medium">{children}</th>,
          td: ({ children }) => <td className="border px-2 py-1 align-top">{children}</td>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground">{children}</blockquote>
          ),
          h1: ({ children }) => <h1 className="mt-3 mb-1.5 text-lg font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-3 mb-1.5 text-base font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-2 mb-1 text-sm font-semibold">{children}</h3>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
