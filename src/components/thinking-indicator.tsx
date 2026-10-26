"use client";

/**
 * Indikator proses streaming ala Gemini: tiga titik bergelombang + timeline
 * fase nyata dari server (mencari di web, membaca sumber, menulis jawaban).
 * Fase adalah fakta dari GenerationEvent — bukan animasi kosong.
 */

import { useT } from "@/lib/i18n/context";

/** Ikon per fase yang dikenal; fase tak dikenal memakai titik polos. */
const PHASE_ICON: Record<string, string> = {
  searching: "🌐",
  reading: "📄",
  "search-done": "✓",
  "search-failed": "⚠",
  generating: "✍️",
  retrieving: "🧠",
};

export function ThinkingDots({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted-foreground" role="status">
      <span className="kawan-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="italic">{label}</span>
    </span>
  );
}

/** Satu fase nyata dari server; `urls` diisi bila fase sedang membuka halaman. */
export type PhaseView = { phase: string; label: string; urls?: string[] };

/** Nama host pendek untuk chip sumber, mis. "github.com". */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Timeline fase selama streaming: langkah terbaru ditonjolkan, riwayat redup. */
export function PhaseTimeline({
  phases,
  active,
}: {
  phases: PhaseView[];
  active: boolean;
}) {
  const t = useT();
  if (phases.length === 0) return null;
  const visible = phases.slice(-3);
  const last = visible[visible.length - 1];
  return (
    <ol
      className="kawan-fade-in mt-1 flex flex-col gap-1 text-xs text-muted-foreground"
      data-testid="phase-timeline"
      aria-label={t("chat.thinking")}
    >
      {visible.slice(0, -1).map((p, i) => (
        <li key={`${p.phase}-${i}`} className="flex items-center gap-1.5 opacity-55">
          <span aria-hidden>{PHASE_ICON[p.phase] ?? "·"}</span>
          <span className="line-through decoration-muted-foreground/40">{p.label}</span>
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden>{PHASE_ICON[last.phase] ?? "·"}</span>
        {active ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="kawan-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>{last.label}</span>
          </span>
        ) : (
          <span>{last.label}</span>
        )}
      </li>
      {/* Sumber yang sedang dibuka: terlihat prosesnya, bukan tebakan. */}
      {last.urls && last.urls.length > 0 && (
        <li className="flex flex-wrap gap-1 pl-4">
          {last.urls.map((url) => (
            <span
              key={url}
              title={url}
              className="inline-flex max-w-48 truncate rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {hostOf(url)}
            </span>
          ))}
        </li>
      )}
    </ol>
  );
}
