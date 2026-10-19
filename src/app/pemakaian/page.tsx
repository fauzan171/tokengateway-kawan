/**
 * Halaman pemakaian token (REQ-NT-71/72).
 *
 * Server Component tipis: pastikan sudah masuk, lalu serahkan ke Client
 * Component yang memuat laporan dan menyediakan unduhan CSV.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { UsageReport } from "@/components/usage-report";
import { serverT } from "@/lib/page-i18n";

export const metadata: Metadata = {
  title: "Pemakaian — Kawan",
  description: "Jumlah token yang dipakai per hari dan per model.",
};

export default async function UsagePage() {
  const t = await serverT();
  const session = await auth();
  if (!session?.user) redirect("/masuk");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("account.badge")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("usage.title")}</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {t("usage.subtitle")}
        </p>
      </header>
      <UsageReport />
    </main>
  );
}
