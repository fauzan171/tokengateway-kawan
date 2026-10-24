"use client";

/**
 * Laporan pemakaian token (REQ-NT-71/72).
 *
 * `reported: false` berarti gateway tidak melaporkan jumlah token. Dalam
 * keadaan itu tidak ada angka yang dirender sama sekali — nol akan terbaca
 * sebagai "kamu memakai nol token", padahal artinya "tidak diketahui".
 *
 * Tidak ada kolom harga, saldo, atau biaya: gateway tidak memberi tarif.
 */

import { useCallback, useEffect, useState } from "react";
import { useT, type Translate } from "@/lib/i18n/context";

type DayRow = { day: string; promptTokens: number; completionTokens: number; totalTokens: number; unreported: number };
type ModelRow = { model: string; promptTokens: number; completionTokens: number; totalTokens: number; unreported: number };
type Report = { reported: boolean; rows: DayRow[] | ModelRow[] };

const RANGES = [7, 30, 90] as const;
function isoDaysAgo(days: number): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export function UsageReport() {
  const t = useT();
  const [days, setDays] = useState<number>(30);
  const [day, setDay] = useState<Report | null>(null);
  const [model, setModel] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = `from=${isoDaysAgo(days)}&to=${new Date().toISOString()}`;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [dayRes, modelRes] = await Promise.all([
        fetch(`/api/kawan/v1/usage?${query}&groupBy=day`),
        fetch(`/api/kawan/v1/usage?${query}&groupBy=model`),
      ]);
      if (!dayRes.ok || !modelRes.ok) throw new Error("gagal");
      setDay((await dayRes.json()) as Report);
      setModel((await modelRes.json()) as Report);
    } catch {
      setError(t("usage.loadFailed"));
    }
  }, [query, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label={t("usage.range")} className="flex gap-2">
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value)}
              aria-pressed={days === value}
              className={`min-h-11 rounded-lg border px-4 text-sm ${days === value ? "bg-muted font-medium" : ""}`}
            >
              {t("usage.days", { count: value })}
            </button>
          ))}
        </div>
        <a
          href={`/api/kawan/v1/usage/export.csv?${query}`}
          download
          className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted"
        >
          {t("usage.downloadCsv")}
        </a>
      </div>

      {error ? (
        <p role="status" aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {day && model ? (
        <Section title={t("usage.perDay")} report={day} kind="day" />
      ) : null}
      {day && model ? (
        <Section title={t("usage.perModel")} report={model} kind="model" />
      ) : null}
    </div>
  );
}

function Section({ title, report, kind }: { title: string; report: Report; kind: "day" | "model" }) {
  const t: Translate = useT();
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {!report.reported ? (
        <p className="text-sm text-muted-foreground">{t("usage.unavailable")}</p>
      ) : report.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("usage.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="py-2 pr-4 font-medium">{kind === "day" ? t("usage.date") : t("usage.model")}</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">{t("usage.promptTokens")}</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">{t("usage.completionTokens")}</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">{t("usage.totalTokens")}</th>
                <th scope="col" className="py-2 text-right font-medium">{t("usage.unreported")}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => {
                const label = "day" in row ? row.day : row.model;
                return (
                  <tr key={label} className="border-b last:border-0">
                    <th scope="row" className="py-2 pr-4 text-left font-normal">{label}</th>
                    <td className="py-2 pr-4 text-right tabular-nums">{row.promptTokens}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{row.completionTokens}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{row.totalTokens}</td>
                    <td className="py-2 text-right tabular-nums">{row.unreported}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
