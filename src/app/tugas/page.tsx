/**
 * Halaman tugas (FIX-08).
 *
 * Server Component tipis: pastikan sudah masuk, lalu serahkan ke Client
 * Component yang memuat daftar dan mengikuti SSE run.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TaskView } from "@/components/task-view";
import { serverT } from "@/lib/page-i18n";

export default async function TasksPage() {
  const t = await serverT();
  const session = await auth();
  if (!session?.user) redirect("/masuk");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("tasks.badge")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("tasks.title")}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{t("tasks.subtitle")}</p>
      </header>
      <TaskView />
    </main>
  );
}