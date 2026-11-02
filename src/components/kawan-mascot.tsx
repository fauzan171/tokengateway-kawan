/**
 * Engine maskot Kawan (DESIGN.md §6, fallback resmi 6.3: SVG prosedural —
 * Three.js tidak muat budget bundle <=180KB gzip). Murni SVG inline + CSS
 * animation via var(--dur-*), tanpa library.
 *
 * 6 agen x 8 state. Tambah agen baru = tambah 1 entri AGENT_ROSTER, engine
 * tidak berubah (DESIGN.md line 301).
 *
 * Warna: hex roster ada DI SINI saja (satu tempat, dianggap data desain);
 * semua render memakai var(--token) untuk elemen adaptif dark mode, dan
 * fill/stroke literal hanya untuk warna badan aksen milik karakter.
 */

export type MascotState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "happy"
  | "error"
  | "sleepy"
  | "alert";

/** Bentuk tubuh 6.2: blob, egg, squircle, shield, beret-tilted, rounded-dark. */
export type MascotShape =
  | "blob"
  | "egg"
  | "squircle"
  | "shield"
  | "tilted"
  | "darkRounded";

/** Aksesori: tepat 1 per agen (6.1). */
export type MascotAccessory =
  | "spark"
  | "glasses"
  | "beret"
  | "bars"
  | "headset"
  | "lights"
  | "none";

export interface AgentVisual {
  id: string;
  shape: MascotShape;
  body: string;
  face?: string; // untuk koder: wajah kontras di atas tubuh gelap
  accent: string;
  accessory: MascotAccessory;
}

/** Roster §6.2 — hex verbatim dari DESIGN.md, satu-satunya tempat hex hidup. */
export const AGENT_ROSTER: readonly AgentVisual[] = Object.freeze([
  { id: "default", shape: "blob", body: "#E9B79B", accent: "#C96442", accessory: "spark" },
  { id: "research", shape: "egg", body: "#B9D3C2", accent: "#4E7A4B", accessory: "glasses" },
  { id: "penulis", shape: "tilted", body: "#D9C7E4", accent: "#7A5C9A", accessory: "beret" },
  { id: "analis", shape: "squircle", body: "#BCD2E6", accent: "#3F6E96", accessory: "bars" },
  { id: "koder", shape: "darkRounded", body: "#3A3832", face: "#F1EFE6", accent: "#E07B57", accessory: "headset" },
  { id: "penjaga", shape: "shield", body: "#F0D9A8", accent: "#A8741A", accessory: "lights" },
] as const);

function resolveVisual(agent?: string): AgentVisual {
  return AGENT_ROSTER.find((a) => a.id === agent) ?? AGENT_ROSTER[0]!;
}

/** Path badan per shape — viewBox 0 0 64 64, chibi 1:1. */
const BODY_PATHS: Record<MascotShape, string> = {
  blob: "M32 6c14 0 24 10 24 24 0 16-11 28-24 28S8 46 8 30C8 16 18 6 32 6Z",
  egg: "M32 4c12 0 20 12 20 24 0 16-9 32-20 32s-20-16-20-32C12 16 20 4 32 4Z",
  squircle: "M32 6h0c14 0 26 12 26 26v2c0 14-12 26-26 26s-26-12-26-26v-2C6 18 18 6 32 6Z",
  shield: "M32 5l24 7v18c0 14-10 26-24 32C18 56 8 44 8 30V12L32 5Z",
  tilted: "M22 8c16-4 30 8 34 20 3 10-2 22-12 26-10 4-24 0-30-10C8 34 12 20 22 8Z",
  darkRounded: "M32 6c15 0 24 10 24 24 0 16-11 28-24 28S8 46 8 30C8 16 17 6 32 6Z",
};

/** Geometri mata per state (§6.1: dua mata besar, tanpa mulut detail).
 * cx/cy posisi, r ukuran, dx/dy offset pupil/highlight untuk arah pandang. */
interface Eyes {
  l: { cx: number; cy: number; r: number; dy?: number; squint?: boolean; closed?: boolean };
  r: { cx: number; cy: number; r: number; dy?: number; squint?: boolean; closed?: boolean };
  track?: "up" | "down" | "side";
  closed?: boolean; // sleepy/sad: jadi garis lengkung
  mood?: string;
}

const EYES_BY_STATE: Record<MascotState, Eyes> = {
  idle: { l: { cx: 26, cy: 27, r: 4 }, r: { cx: 40, cy: 27, r: 4 } },
  listening: { l: { cx: 26, cy: 26, r: 4.5 }, r: { cx: 40, cy: 26, r: 4.5 }, track: "side" },
  thinking: { l: { cx: 26, cy: 24, r: 3.5 }, r: { cx: 40, cy: 23, r: 3.5 }, track: "up" },
  speaking: { l: { cx: 26, cy: 27, r: 4 }, r: { cx: 40, cy: 27, r: 4 }, mood: "speak" },
  happy: { l: { cx: 26, cy: 27, r: 4, squint: true }, r: { cx: 40, cy: 27, r: 4, squint: true } },
  error: { l: { cx: 26, cy: 27, r: 4, squint: true }, r: { cx: 40, cy: 27, r: 4, squint: true }, mood: "sad" },
  sleepy: { l: { cx: 26, cy: 29, r: 3.5, closed: true }, r: { cx: 40, cy: 29, r: 3.5, closed: true } },
  alert: { l: { cx: 26, cy: 24, r: 5 }, r: { cx: 40, cy: 24, r: 5 } },
};

const EYE_COLOR = "#1F1E1B"; // §6.1 verbatim
const CHEEK_COLOR = "#E8836B"; // §6.1 verbatim, opacity 0.35

export interface KawanMascotProps {
  /** Id agent dari AgentEntry.id; asing/null => "default". */
  agent?: string;
  state?: MascotState;
  size?: number;
  /** Animasi CSS; false atau prefers-reduced-motion => pose statis. */
  animated?: boolean;
  className?: string;
}

/**
 * Pose dinamis via keyframes kawan-mascot-* di globals.css:
 * thinking = bob pelan, speaking = denyut, alert = shake ringan.
 * animated=false cukup meniadakan class animasi — SVG tetap utuh.
 */
export function KawanMascot({
  agent,
  state = "idle",
  size = 64,
  animated = true,
  className = "",
}: KawanMascotProps) {
  const v = resolveVisual(agent);
  const eyes = EYES_BY_STATE[state];
  // Warna mata: gelap di atas muka terang, terang di atas tubuh gelap (koder).
  const eyeStroke = v.face ? v.face : EYE_COLOR;
  const pupilFill = v.face ? v.body : EYE_COLOR;

  const animClass =
    animated && state === "thinking"
      ? "kawan-mascot-bob"
      : animated && state === "speaking"
        ? "kawan-mascot-pulse"
        : animated && state === "alert"
          ? "kawan-mascot-shake"
          : "";

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-hidden
      className={`${className}${animClass ? ` ${animClass}` : ""}`}
      data-testid={`mascot-${v.id}-${state}`}
    >
      {/* Badan */}
      <path d={BODY_PATHS[v.shape]} fill={v.body} stroke={v.accent} strokeWidth={2} />

      {/* Panel wajah (hanya koder): lingkaran terang di tubuh gelap. */}
      {v.face && <ellipse cx={32} cy={28} rx={17} ry={15} fill={v.face} />}

      {/* Mata */}
      {([eyes.l, eyes.r] as const).map((e, i) =>
        e.closed ? (
          <path
            key={i}
            d={`M${e.cx - 4} ${e.cy} q4 ${eyes.mood === "sad" ? -2.5 : 3} 8 0`}
            stroke={eyeStroke}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
        ) : e.squint ? (
          // happy: lengkung senyum-mata ^ ^
          <path
            key={i}
            d={`M${e.cx - 4} ${e.cy + 1} q4 -5 8 0`}
            stroke={eyeStroke}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <g key={i}>
            <circle
              cx={e.cx}
              cy={e.cy}
              r={e.r}
              fill={pupilFill}
              className={eyes.track ? `kawan-mascot-eyes kawan-mascot-eyes-${eyes.track}` : undefined}
            />
            {/* highlight putih kecil §6.1 */}
            <circle cx={e.cx + e.r * 0.35} cy={e.cy - e.r * 0.35} r={e.r * 0.3} fill="#FFFFFF" />
          </g>
        ),
      )}

      {/* Mulut minimal: happy/speaking/error saja (§6.1 "tanpa detail berlebih"). */}
      {state === "happy" && (
        <path d="M26 38q6 6 12 0" stroke={eyeStroke} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      )}
      {state === "speaking" && (
        <ellipse cx={32} cy={38} rx={4} ry={2.5} fill={eyeStroke} />
      )}
      {state === "error" && (
        <path d="M26 40q6 -5 12 0" stroke={eyeStroke} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      )}

      {/* Pipi merona */}
      <circle cx={18} cy={34} r={2.5} fill={CHEEK_COLOR} opacity={0.35} />
      <circle cx={46} cy={34} r={2.5} fill={CHEEK_COLOR} opacity={0.35} />

      {/* Aksesori — tepat 1 per agen */}
      {v.accessory === "spark" && (
        <path d="M50 12l1.8 4 4 1.8-4 1.8L50 24l-1.8-4.4-4-1.8 4-1.8Z" fill={v.accent} />
      )}
      {v.accessory === "glasses" && (
        <g stroke={v.accent} strokeWidth={2} fill="none">
          <circle cx={26} cy={27} r={6.5} />
          <circle cx={40} cy={27} r={6.5} />
          <path d="M32.5 27h1M19.5 26l-3-2M46.5 26l3-2" />
        </g>
      )}
      {v.accessory === "beret" && (
        <path d="M20 14c2-8 18-10 26-4 3 2 1 5-3 5-8 2-16 2-23-1Z" fill={v.accent} />
      )}
      {v.accessory === "bars" && (
        <g fill={v.accent}>
          <rect x={20} y={48} width={5} height={8} rx={1} />
          <rect x={29} y={44} width={5} height={12} rx={1} />
          <rect x={38} y={50} width={5} height={6} rx={1} />
        </g>
      )}
      {v.accessory === "headset" && (
        <g stroke={v.accent} strokeWidth={2.5} fill="none">
          <path d="M16 26c0-9 7-14 16-14s16 5 16 14" />
          <rect x={12} y={26} width={7} height={10} rx={3} fill={v.accent} stroke="none" />
          <rect x={45} y={26} width={7} height={10} rx={3} fill={v.accent} stroke="none" />
          {/* mikrofon + glyph `</>` (§6.2 koder) */}
          <path d="M52 36c2 6-4 10-12 10" />
          <text x={30} y={13} fontSize={7} fill={v.accent} stroke="none" textAnchor="middle" fontFamily="monospace">
            &lt;/&gt;
          </text>
        </g>
      )}
      {v.accessory === "lights" && (
        <g>
          <path d="M32 5l6 8H26Z" fill={v.accent} />
          <circle cx={32} cy={10} r={2} fill="var(--warning, #d9a441)">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
      )}
      <title>{`${agent ?? "default"}:${state}`}</title>
      {/* face warna tidak dipakai langsung — cegah linter unused; eksplisit di atas */}
      <desc>{`kawan-mascot ${agent ?? "default"} ${state}`}</desc>
    </svg>
  );
}
