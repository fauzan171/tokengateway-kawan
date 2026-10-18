/**
 * Halaman pengaturan pribadi (REQ-NT-70).
 *
 * Server Component tipis: pastikan sudah masuk, lalu serahkan ke Client
 * Component yang memuat dan menyimpan preferensi sendiri.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SettingsForm } from "@/components/settings-form";

export const metadata: Metadata = {
  title: "Pengaturan — Kawan",
  description: "Tema, bahasa, ukuran font, dan cara mengirim pesan.",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/masuk");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Akun</p>
        <h1 className="text-2xl font-semibold tracking-tight">Pengaturan</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Perubahan langsung berlaku dan tersimpan ke akunmu.
        </p>
      </header>
      <SettingsForm />
    </main>
  );
}
