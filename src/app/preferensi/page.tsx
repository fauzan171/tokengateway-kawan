/**
 * Halaman pengaturan pribadi (REQ-NT-70).
 *
 * Server Component tipis: pastikan sudah masuk, lalu serahkan ke Client
 * Component yang memuat dan menyimpan preferensi sendiri.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SettingsForm } from "@/components/settings-form";
import { serverT } from "@/lib/page-i18n";
import { pageMetadata } from "@/lib/i18n/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("preferensi");
}

export default async function SettingsPage() {
  const t = await serverT();
  const session = await auth();
  if (!session?.user) redirect("/masuk");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("account.badge")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("account.title")}</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {t("account.settingsSubtitle")}
        </p>
      </header>
      <SettingsForm />
    </main>
  );
}
