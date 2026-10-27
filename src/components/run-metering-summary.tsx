"use client";

/**
 * Ringkasan pemakaian token sebuah run (SDD-FRONTEND §D6).
 *
 * Murni tampil: tanpa state, tanpa fetch. `metering` null/undefined → tanpa
 * render. Tidak ada baris biaya — gateway tidak memberi tarif (non-goal
 * billing), jadi `estimatedCostUsd` tidak pernah ditampilkan.
 *
 * `usage.reported === false` berarti angka berasal dari estimasi, bukan
 * laporan gateway: catatan kejujuran ditampilkan hanya pada keadaan itu.
 */

import { useT } from "@/lib/i18n/context";
// Impor tipe saja (hilang saat build): kontrak DTO didefinisikan server.
import type { RunMetering } from "@/lib/tasks/budget";

export type { RunMetering };

const nf = new Intl.NumberFormat("id-ID");

export function RunMeteringSummary({ metering }: { metering?: RunMetering | null }) {
  const t = useT();
  // `null` (run pra-D6) → tidak ada data, bukan pemakaian nol.
  if (!metering) return null;

  const { promptTokens, completionTokens, reported } = metering.usage;
  // `null` = gateway tidak melapor; jangan disisipkan ke kalimat "{n} token
  // masuk" (hasilnya "tidak dilaporkan token masuk"), dan jangan diformat —
  // `nf.format(null)` menghasilkan "0", yaitu klaim pemakaian nol.
  const usage =
    promptTokens === null || completionTokens === null
      ? t("tasks.metering.unreported")
      : `${t("tasks.metering.tokensIn", { count: nf.format(promptTokens) })} / ${t("tasks.metering.tokensOut", {
          count: nf.format(completionTokens),
        })}`;

  // Run non-riset tak pernah membaca halaman: "0 sumber" hanya derau.
  const parts = [usage];
  if (metering.sourcesRead > 0) {
    parts.push(t("tasks.metering.sources", { count: nf.format(metering.sourcesRead) }));
  }
  const note = t("tasks.metering.estimateNote");

  return (
    <p className="text-xs text-muted-foreground">
      <span title={reported ? undefined : note} className="break-words">
        {parts.join(" · ")}
      </span>
      {reported ? null : <span className="ml-1">({note})</span>}
    </p>
  );
}