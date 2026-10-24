/**
 * Halaman pengaturan akun (REQ-NT-14, SDD-7.2).
 *
 * Server Component tipis: memastikan pengguna sudah masuk, lalu menyerahkan
 * formulir ke Client Component. Tanpa sesi, pengguna dialihkan ke `/masuk`.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/change-password-form";
import { serverT } from "@/lib/page-i18n";
import { pageMetadata } from "@/lib/i18n/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("pengaturan");
}

export default async function PengaturanPage() {
  const t = await serverT();
  const session = await auth();
  if (!session?.user) redirect("/masuk");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-7 flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("account.badge")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("account.title")}</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {t("account.signedInAs", { email: session.user.email ?? "" })}
        </p>
      </header>

      <section aria-labelledby="ganti-sandi-title" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="ganti-sandi-title" className="text-lg font-semibold tracking-tight">
            {t("account.changePasswordTitle")}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {t("account.changePasswordBody")}
          </p>
        </div>
        <ChangePasswordForm />
      </section>

      <footer className="mt-auto pt-8">
        <a
          href="https://tokengateway.ai.id"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-6 items-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          by tokengateway.ai.id
        </a>
      </footer>
    </main>
  );
}
