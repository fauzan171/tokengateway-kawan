/**
 * Halaman kebijakan privasi (REQ-NT-79).
 *
 * Statis, tanpa sesi: harus bisa dibaca sebelum mendaftar. Teks diambil dari
 * `src/lib/legal/privacy.ts` supaya halaman dan `docs/privacy.md` tidak
 * menyimpang.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY_EFFECTIVE_DATE, PRIVACY_SECTIONS } from "@/lib/legal/privacy";
import { serverT } from "@/lib/page-i18n";

export const metadata: Metadata = {
  title: "Kebijakan privasi — Kawan",
  description: "Data apa yang disimpan Kawan, di mana, dan cara menghapusnya.",
};

/** Tanggal ISO → "18 Oktober 2026" tanpa dependensi tambahan. */
function formatDate(iso: string): string {
  const bulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const [tahun, bulanKe, hari] = iso.split("-").map(Number);
  return `${hari} ${bulan[(bulanKe ?? 1) - 1]} ${tahun}`;
}

export default async function PrivacyPage() {
  const t = await serverT();
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("legal.badge")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("legal.title")}</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {t("legal.effective", { date: formatDate(PRIVACY_EFFECTIVE_DATE) })}
        </p>
      </header>

      <div className="flex flex-col gap-8">
        {PRIVACY_SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-medium">{section.heading}</h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground">
              {section.body.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10 text-sm leading-6 text-muted-foreground">
        {t("legal.changeNote")}
      </p>
      <p className="mt-6 text-sm">
        <Link href="/" className="underline underline-offset-4">{t("legal.back")}</Link>
      </p>
    </main>
  );
}
