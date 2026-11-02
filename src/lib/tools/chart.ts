/**
 * Grafik SVG deklaratif (FIX-15).
 *
 * SVG dibuat dari data tervalidasi, bukan dari string HTML model. Tidak ada
 * `<script>`, `on*`, atau `xlink:href` luar; label di-escape. Setiap grafik
 * membawa tabel alternatif supaya pembaca layar mendapat angka yang sama.
 *
 * shortcut: hanya bar dan line, satu seri. Tambahkan seri ganda saat ada
 * kebutuhan nyata; tabel alternatif sudah menutup aksesibilitas.
 */

export type ChartKind = "bar" | "line";

export type ChartPoint = { label: string; value: number };

export type ChartRequest = {
  kind: ChartKind;
  points: ChartPoint[];
  title: string;
  /** Satuan sumbu Y, mis. `Rp`, `%`, `ms`. */
  unit?: string | null;
  /** Nama sumbu X dan Y. */
  xLabel?: string | null;
  yLabel?: string | null;
};

export class ChartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChartError";
  }
}

export const CHART_LIMITS = { maxPoints: 60, width: 640, height: 360, pad: 48 } as const;

// CHART-INLINE: satu palet untuk semua grafik (SVG chat + PDF), selaras TEMA.
export const CHART_PALETTE = { bar: "#6366f1", line: "#6366f1", grid: "#e5e7eb", axis: "#9ca3af", text: "#374151", title: "#111827" } as const;

/** Escape XML — label datang dari model/pengguna, bukan kode. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Angka untuk atribut SVG; NaN/Infinity ditolak, bukan jadi `NaN` di dokumen. */
function num(value: number): string {
  if (!Number.isFinite(value)) throw new ChartError("Nilai grafik bukan bilangan hingga.");
  return String(Math.round(value * 100) / 100);
}

export function renderChart(request: ChartRequest): { svg: string; table: string } {
  const { kind, points, title } = request;
  if (kind !== "bar" && kind !== "line") {
    throw new ChartError(`Jenis grafik "${String(kind)}" tidak didukung.`);
  }
  if (!Array.isArray(points) || points.length === 0) {
    throw new ChartError("Grafik membutuhkan minimal satu titik data.");
  }
  if (points.length > CHART_LIMITS.maxPoints) {
    throw new ChartError(`Maksimal ${CHART_LIMITS.maxPoints} titik per grafik.`);
  }
  for (const point of points) {
    if (typeof point.label !== "string" || typeof point.value !== "number") {
      throw new ChartError("Setiap titik butuh `label` string dan `value` angka.");
    }
    if (!Number.isFinite(point.value)) {
      throw new ChartError(`Nilai untuk "${point.label}" bukan bilangan hingga.`);
    }
  }

  const { width, height, pad } = CHART_LIMITS;
  const values = points.map((p) => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;
  const yOf = (v: number): number => pad + plotH - ((v - min) / span) * plotH;

  const marks: string[] = [];
  // VISUAL-UNIFY: bar rounded + label di atas, selaras kartu ChatGPT/Glm 5.3.
  if (kind === "bar") {
    const slot = plotW / points.length;
    const barW = Math.min(slot * 0.7, 60);
    points.forEach((point, i) => {
      const x = pad + slot * i + (slot - barW) / 2;
      const y = yOf(point.value);
      const h = Math.abs(yOf(0) - y);
      marks.push(
        `<rect x="${num(x)}" y="${num(Math.min(y, yOf(0)))}" width="${num(barW)}" height="${num(h)}" rx="3" fill="${CHART_PALETTE.bar}"/>`,
      );
      marks.push(
        `<text x="${num(x + barW / 2)}" y="${num(Math.min(y, yOf(0)) - 5)}" font-size="10" text-anchor="middle" fill="${CHART_PALETTE.text}">${esc(String(point.value))}</text>`,
      );
    });
  } else {
    const step = points.length === 1 ? 0 : plotW / (points.length - 1);
    const coords = points.map((point, i) => `${num(pad + step * i)},${num(yOf(point.value))}`);
    // VISUAL-UNIFY: area fill + garis tebal + titik putih berbingkai.
    marks.push(
      `<polygon fill="${CHART_PALETTE.line}" opacity="0.12" points="${num(pad)},${num(yOf(0))} ${coords.join(" ")} ${num(pad + plotW)},${num(yOf(0))}"/>`,
    );
    marks.push(
      `<polyline fill="none" stroke="${CHART_PALETTE.line}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${coords.join(" ")}"/>`,
    );
    points.forEach((point, i) => {
      marks.push(
        `<circle cx="${num(pad + step * i)}" cy="${num(yOf(point.value))}" r="3.5" fill="#fff" stroke="${CHART_PALETTE.line}" stroke-width="2"/>`,
      );
    });
  }

  // VISUAL-UNIFY: grid horizontal 4 garis + tick max/mid/min ala kartu analitik.
  const mid = (max + min) / 2;
  const gridVals = [max, mid, min];
  const gridLines = gridVals
    .map((v) => `<line x1="${pad}" y1="${num(yOf(v))}" x2="${num(width - pad)}" y2="${num(yOf(v))}" stroke="${CHART_PALETTE.grid}"/>`)
    .join("");

  const labelStep = Math.ceil(points.length / 12);
  const xLabels = points
    .map((point, i) =>
      i % labelStep === 0
        ? `<text x="${num(pad + (kind === "bar" ? (plotW / points.length) * (i + 0.5) : points.length === 1 ? plotW / 2 : (plotW / (points.length - 1)) * i))}" y="${num(height - pad + 14)}" font-size="9" text-anchor="middle" fill="#444">${esc(point.label.slice(0, 16))}</text>`
        : "",
    )
    .join("");

  const unit = request.unit ? ` (${request.unit})` : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" ` +
    `aria-label="${esc(title)}" width="${width}" height="${height}">` +
    `<title>${esc(title)}</title>` +
    `<rect width="${width}" height="${height}" rx="8" fill="#fff"/>` +
    `<text x="${num(width / 2)}" y="22" font-size="14" font-weight="600" text-anchor="middle" fill="${CHART_PALETTE.title}">${esc(title)}</text>` +
    gridLines +
    `<line x1="${pad}" y1="${num(yOf(0))}" x2="${num(width - pad)}" y2="${num(yOf(0))}" stroke="${CHART_PALETTE.axis}"/>` +
    `<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${num(height - pad)}" stroke="${CHART_PALETTE.axis}"/>` +
    (request.yLabel ? `<text x="12" y="${num(pad + plotH / 2)}" font-size="10" fill="${CHART_PALETTE.text}" transform="rotate(-90 12 ${num(pad + plotH / 2)})">${esc(request.yLabel + unit)}</text>` : "") +
    (request.xLabel ? `<text x="${num(width / 2)}" y="${num(height - 8)}" font-size="10" text-anchor="middle" fill="${CHART_PALETTE.text}">${esc(request.xLabel)}</text>` : "") +
    `<text x="${num(pad - 6)}" y="${num(yOf(max) + 4)}" font-size="9" text-anchor="end" fill="${CHART_PALETTE.text}">${num(max)}</text>` +
    `<text x="${num(pad - 6)}" y="${num(yOf(mid) + 4)}" font-size="9" text-anchor="end" fill="${CHART_PALETTE.text}">${num(Math.round(mid * 100) / 100)}</text>` +
    `<text x="${num(pad - 6)}" y="${num(yOf(min) + 4)}" font-size="9" text-anchor="end" fill="${CHART_PALETTE.text}">${num(min)}</text>` +
    marks.join("") +
    xLabels +
    `</svg>`;

  // Tabel alternatif: pembaca layar mendapat angka yang sama dengan grafik.
  const rows = points
    .map((p) => `<tr><td>${esc(p.label)}</td><td>${esc(String(p.value))}</td></tr>`)
    .join("");
  const table =
    `<table><caption>${esc(title)}${esc(unit)}</caption>` +
    `<thead><tr><th scope="col">${esc(request.xLabel ?? "Label")}</th>` +
    `<th scope="col">${esc(request.yLabel ?? "Nilai")}${esc(unit)}</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`;

  return { svg, table };
}
