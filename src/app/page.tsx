"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Menu, MessageCircle, Plus, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatView } from "@/components/chat-view";

type Theme = "system" | "light" | "dark";

export default function Home() {
  const router = useRouter();
  const [section, setSection] = useState("chat");
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");

  /**
   * Pengalihan onboarding (REQ-NT-01): pengguna yang sudah masuk tetapi belum
   * punya koneksi aktif diarahkan ke `/onboarding`. Pemeriksaan dilakukan di
   * klien lewat endpoint yang sudah ada — tanpa menyentuh berkas server lain.
   * Belum masuk (401) atau jaringan gagal dibiarkan: beranda tetap tampil.
   */
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/kawan/v1/connections", { signal: controller.signal });
        if (!response.ok) return;
        const payload = (await response.json().catch(() => null)) as
          | { connections?: { isActive?: boolean }[] }
          | null;
        const hasActive = payload?.connections?.some((item) => item.isActive === true) ?? false;
        if (!hasActive) router.replace("/onboarding");
      } catch {
        /* Dibiarkan: beranda tetap tampil bila pemeriksaan tidak dapat dijalankan. */
      }
    })();
    return () => controller.abort();
  }, [router]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kawan-theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch { /* Storage can be unavailable in private browsers. */ }
  }, []);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  function navigate(next: string) {
    setSection(next);
    setOpen(false);
  }

  const navigation = (
    <div className="flex h-full flex-col p-5">
      <div className="mb-9 flex items-center gap-3 text-xl font-semibold"><span className="rounded-xl bg-foreground p-2 text-background"><MessageCircle aria-hidden className="size-5" /></span>Kawan</div>
      <Button className="h-11 w-full justify-start gap-3" onClick={() => navigate("chat")}><Plus aria-hidden />Chat baru</Button>
      <nav aria-label="Navigasi utama" className="mt-8 space-y-2">
        {[ ["chat", "Percakapan"], ["settings", "Pengaturan"], ["about", "Tentang Kawan"] ].map(([id, label]) => (
          <Button key={id} variant="ghost" className="h-11 w-full justify-start" aria-current={section === id ? "page" : undefined} onClick={() => navigate(id!)}>{label}</Button>
        ))}
      </nav>
      <div className="mt-10 border-t pt-5 text-sm text-muted-foreground"><p>Ruang untuk ide berikutnya.</p><p className="mt-2 text-xs">Percakapanmu akan muncul di sini setelah fitur chat tersedia.</p></div>
      <a className="mt-auto pt-8 text-xs text-muted-foreground underline-offset-4 hover:underline" href="https://tokengateway.ai.id" target="_blank" rel="noopener noreferrer">by tokengateway.ai.id</a>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-background">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4">Lewati navigasi</a>
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:block">{navigation}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-20 items-center justify-between border-b px-5 sm:px-9">
          <div className="flex items-center gap-3">
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger render={<Button variant="ghost" className="size-11 md:hidden" aria-label="Buka menu" />}><Menu /></Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40" />
                <Dialog.Popup className="fixed inset-y-0 left-0 z-50 w-[min(85vw,20rem)] bg-sidebar pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
                  <Dialog.Title className="sr-only">Menu Kawan</Dialog.Title>
                  <Dialog.Close render={<Button variant="ghost" className="absolute right-2 top-2 size-11" aria-label="Tutup menu" />}><X /></Dialog.Close>
                  {navigation}
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
            <span className="text-sm font-medium">{section === "chat" ? "Percakapan baru" : section === "settings" ? "Pengaturan" : "Tentang Kawan"}</span>
          </div>
          <span className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground">Pratinjau</span>
        </header>
        <main id="content" className="flex flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-9">
          {section === "chat" ? (
            <ChatView />
          ) : section === "settings" ? (
            <section className="mx-auto w-full max-w-3xl py-12"><Settings aria-hidden className="mb-5 size-7" /><h1 className="text-3xl font-semibold">Buat nyaman ruangmu.</h1><p className="mt-3 text-muted-foreground">Sesuaikan tampilan Kawan dengan caramu bekerja.</p><div className="mt-10 rounded-2xl border p-6"><label htmlFor="theme" className="block font-medium">Tema tampilan</label><p className="mt-2 text-sm text-muted-foreground">Pilihan tersimpan di perangkat ini jika penyimpanan browser tersedia.</p><select id="theme" value={theme} onChange={event => { const value = event.target.value as Theme; setTheme(value); try { localStorage.setItem("kawan-theme", value); } catch { /* Theme remains usable without storage. */ } }} className="mt-5 min-h-11 w-full rounded-lg border bg-background px-3 sm:w-56"><option value="system">Ikuti sistem</option><option value="light">Terang</option><option value="dark">Gelap</option></select></div></section>
          ) : (
            <section className="mx-auto w-full max-w-3xl py-12"><h1 className="text-3xl font-semibold">Kawan</h1><p className="mt-5 leading-7 text-muted-foreground">Chat pribadi dengan kunci API milikmu sendiri. Versi 0.1.0 — fondasi antarmuka; fitur chat belum tersedia.</p><a href="https://tokengateway.ai.id" target="_blank" rel="noopener noreferrer" className="mt-6 inline-block underline">by tokengateway.ai.id</a></section>
          )}
          <footer className="text-center text-xs leading-6 text-muted-foreground">Kawan · Ruang untuk percakapan bermakna</footer>
        </main>
      </div>
    </div>
  );
}
