/**
 * Panel admin (REQ-NT-74/75/76/77).
 *
 * Server Component tipis: pastikan sudah masuk dan berperan admin, lalu
 * serahkan ke Client Component. Penolakan peran terjadi dua kali — di sini
 * (pengguna biasa tidak melihat panel) dan di setiap route admin (403).
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { AdminPanel } from "@/components/admin-panel";
import { serverT } from "@/lib/page-i18n";
import { pageMetadata } from "@/lib/i18n/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("admin");
}

export default async function AdminPage() {
  const t = await serverT();
  const session = await auth();
  if (!session?.user) redirect("/masuk");

  const db = await getDb(loadConfig().databaseUrl);
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "admin") redirect("/");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("adminPage.badge")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("adminPage.title")}</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {t("adminPage.subtitle")}
        </p>
      </header>
      <AdminPanel />
    </main>
  );
}
