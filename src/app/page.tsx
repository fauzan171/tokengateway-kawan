"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Menu, PanelLeft, Plus, Settings, ShieldCheck, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ChatView } from "@/components/chat-view";
import { useT } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/messages";

type Theme = "system" | "light" | "dark";

const SECTION_LABEL: Record<string, MessageKey> = {
  chat: "home.newChatHeader",
};

export default function Home() {
  const t = useT();
  const router = useRouter();
  const [section, setSection] = useState("chat");
  const [open, setOpen] = useState(false);
  // UX-2: sidebar dapat diciutkan (w-64 <-> w-16) ala Gemini.
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);


  /**
   * Gerbang masuk + pengalihan onboarding (REQ-NT-01): pengguna yang belum
   * masuk diarahkan ke `/masuk`, yang sudah masuk tetapi belum punya koneksi
   * aktif diarahkan ke `/onboarding`. Pemeriksaan dilakukan di klien lewat
   * endpoint yang sudah ada — tanpa menyentuh berkas server lain.
   * Jaringan gagal dibiarkan: beranda tetap tampil.
   */
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/kawan/v1/connections", { signal: controller.signal });
        // Tanpa ini shell chat dirender penuh untuk anonim, dan setiap
        // endpoint yang gagal 401 menempelkan "Sesi berakhir" di kotak input.
        if (response.status === 401) {
          router.replace("/masuk");
          return;
        }
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
    <div className="flex h-full min-h-0 flex-col px-3 pt-4 pb-3">
      <div className="mb-4 flex items-center gap-2.5 px-2 text-[1.05rem] font-semibold tracking-tight"><BrandMark className="size-8" />Kawan</div>
      <Button className="h-10 w-full justify-start gap-2.5 rounded-xl text-sm font-medium shadow-sm" onClick={() => { setActiveChatId(null); navigate("chat"); }}><Plus aria-hidden />{t("nav.newChat")}</Button>
      <ChatSidebar activeChatId={activeChatId} onSelect={(id) => { setActiveChatId(id); navigate("chat"); }} />
      <nav aria-label={t("nav.account")} className="mt-auto border-t pt-2">
        <a
          href="/pengaturan"
          className="flex h-11 items-center gap-3 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings aria-hidden className="size-4.5" />
          {t("nav.settings")}
        </a>
        <a
          href="/privasi"
          className="flex h-11 items-center gap-3 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ShieldCheck aria-hidden className="size-4.5" />
          {t("nav.privacy")}
        </a>
      </nav>
      <a className="mt-2 px-3 text-xs text-muted-foreground/70" href="https://tokengateway.ai.id" target="_blank" rel="noopener noreferrer">by tokengateway.ai.id</a>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4">{t("nav.skip")}</a>
      <aside className={`hidden h-full shrink-0 overflow-hidden border-r bg-sidebar transition-all duration-300 ease-in-out md:block ${collapsed ? "w-16" : "w-64"}`}>{navigation}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b/60 bg-background/80 px-4 backdrop-blur sm:h-14 sm:px-6">
          <div className="flex items-center gap-3">
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Button variant="ghost" className="hidden size-10 rounded-full md:inline-flex" aria-label={t("nav.toggleSidebar")} title={t("nav.toggleSidebar")} onClick={() => setCollapsed((v) => !v)}><PanelLeft className="size-4" /></Button>
              <Dialog.Trigger render={<Button variant="ghost" className="size-11 md:hidden" aria-label={t("nav.openMenu")} />}><Menu /></Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 data-[ending-style]:opacity-0" />
                <Dialog.Popup className="fixed inset-y-0 left-0 z-50 w-[min(85vw,20rem)] bg-sidebar pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-transform duration-200 data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full">
                  <Dialog.Title className="sr-only">{t("nav.menuTitle")}</Dialog.Title>
                  <Dialog.Close render={<Button variant="ghost" className="absolute right-2 top-2 size-11" aria-label={t("nav.closeMenu")} />}><X /></Dialog.Close>
                  {navigation}
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
            <span className="text-sm font-medium">{t(SECTION_LABEL[section] ?? "home.newChatHeader")}</span>
          </div>
<span className="hidden rounded-full border px-3 py-1.5 text-xs text-muted-foreground sm:inline-flex">{t("home.preview")}</span>
        </header>
        <main id="content" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-9">
          {section === "chat" ? (
            <ChatView initialChatId={activeChatId} onChatCreated={setActiveChatId} />
          ) : (
<section className="mx-auto w-full max-w-3xl py-12"><h1 className="text-3xl font-semibold">Kawan</h1><p className="mt-5 leading-7 text-muted-foreground">{t("home.aboutBody")}</p><a href="https://tokengateway.ai.id" target="_blank" rel="noopener noreferrer" className="mt-6 inline-block underline">by tokengateway.ai.id</a></section>
          )}
          <footer className="text-center text-xs leading-6 text-muted-foreground">{t("home.footer")}</footer>
        </main>
      </div>
    </div>
  );
}
