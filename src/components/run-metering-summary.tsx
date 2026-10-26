"use client";

/**
 * Ringkasan pemakaian token sebuah run (SDD-FRONTEND §D6).
 *
 * Murni tampil: tanpa state, tanpa fetch. `metering === undefined` → tanpa
 * render. Tidak ada baris biaya — gateway tidak memberi tarif (non-goal
 * billing), jadi `estimatedCostUsd` tidak pernah ditampilkan.
 *
 * `usage.reported === false` berarti angka berasal dari estimasi, bukan
 * laporan gateway: catatan kejujuran ditampilkan hanya pada keadaan itu.
 */

import { useT } from "@/lib/i18n/context";

export type RunMetering = {
  usage: { reported: boolean; promptTokens: number; completionTokens: number; totalTokens: number };
  consumed: { promptTokens: number; completionTokens: number; searches: number; reads: number; toolCalls: number };
  sourcesRead: number;
};

const nf = new Intl.NumberFormat("id-ID");

export function RunMeteringSummary({ metering }: { metering?: RunMetering }) {
  const t = useT();
  if (!metering) return null;

  const tokensIn = t("tasks.metering.tokensIn", { count: nf.format(metering.usage.promptTokens) });
  const tokensOut = t("tasks.metering.tokensOut", { count: nf.format(metering.usage.completionTokens) });
  const sources = t("tasks.metering.sources", { count: nf.format(metering.sourcesRead) });
  const note = t("tasks.metering.estimateNote");

  return (
    <p className="text-xs text-muted-foreground">
      <span title={metering.usage.reported ? undefined : note} className="break-words">
        {`${tokensIn} / ${tokensOut} · ${sources}`}
      </span>
      {metering.usage.reported ? null : <span className="ml-1">({note})</span>}
    </p>
  );
}