/**
 * Maskot Kawan (UX-1): karakter blob sederhana murni SVG inline — tanpa aset,
 * tanpa animasi berat. `mood` mengikuti kondisi nyata antarmuka: `idle` saat
 * menunggu, `thinking` saat generasi berjalan (mata mengikuti progres nyata,
 * bukan animasi pura-pura), `sad` saat galat. Ukuran ikut properti `size`.
 */
export type MascotMood = "idle" | "thinking" | "sad";

export function KawanMascot({
  mood = "idle",
  size = 64,
  className = "",
}: {
  mood?: MascotMood;
  size?: number;
  className?: string;
}) {
  const body =
    mood === "sad" ? "fill-warning/80" : mood === "thinking" ? "fill-primary/15" : "fill-primary/10";
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-hidden
      className={className}
      data-testid={`mascot-${mood}`}
    >
      {/* Badan blob: bulat agak lonjong, satu goresan saja. */}
      <path
        d="M32 6c14 0 24 10 24 24 0 16-11 28-24 28S8 46 8 30C8 16 18 6 32 6Z"
        className={`${body} stroke-primary/40`}
        strokeWidth={2}
      />
      {/* Mata: saat berpikir melirik ke atas-kanan seperti sedang menyusun jawaban. */}
      {mood === "thinking" ? (
        <>
          <circle cx={26} cy={26} r={3} className="fill-foreground" />
          <circle cx={40} cy={24} r={3} className="fill-foreground" />
        </>
      ) : mood === "sad" ? (
        <>
          <circle cx={26} cy={27} r={3} className="fill-foreground" />
          <circle cx={40} cy={27} r={3} className="fill-foreground" />
          <path d="M24 42q8-6 16 0" className="stroke-foreground" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={26} cy={26} r={3} className="fill-foreground" />
          <circle cx={40} cy={26} r={3} className="fill-foreground" />
          <path d="M24 38q8 7 16 0" className="stroke-foreground" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </>
      )}
      {/* Pipi merona — biar terlihat ramah, bukan bot dingin. */}
      <circle cx={18} cy={34} r={2.5} className="fill-primary/30" />
      <circle cx={48} cy={34} r={2.5} className="fill-primary/30" />
    </svg>
  );
}
