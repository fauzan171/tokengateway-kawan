/**
 * Halaman publik snapshot (REQ-NT-36/41). Tanpa sesi, tanpa data akun:
 * judul, waktu, dan isi percakapan saja.
 */

import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { serverT } from "@/lib/page-i18n";
import { getPublicShare } from "@/lib/chat/share";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

/** Satu pembacaan per request: metadata dan halaman berbagi hasil yang sama. */
const loadShare = cache(async (token: string) => {
  try {
    const db = await getDb(loadConfig().databaseUrl);
    return await getPublicShare(db, token);
  } catch {
    return null;
  }
});

/**
 * `notFound()` dipanggil DI SINI, bukan hanya di halaman.
 *
 * Metadata diselesaikan sebelum header respons dikirim, jadi `notFound()` di
 * sini menghasilkan status 404 sungguhan (AUD-04). Halaman tetap memanggil
 * `notFound()` sebagai jaring pengaman.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const share = await loadShare(token);
  if (!share) notFound();
  return {
    title: share.title,
    robots: { index: false, follow: false },
  };
}

export default async function SharePage({ params }: PageProps) {
  const t = await serverT();
  const { token } = await params;
  const share = await loadShare(token);
  if (!share) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1 border-b pb-4">
        <h1 className="text-xl font-semibold">{share.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t("share.sharedAt", { date: new Date(share.createdAt).toLocaleString("id-ID") })}
        </p>
      </header>
      <ol className="flex flex-col gap-4">
        {share.messages.map((message, index) => (
          <li key={`${message.createdAt}-${index}`} className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {message.role === "user" ? t("share.you") : "Kawan"}
            </span>
            {message.role === "user" ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p>
            ) : (
              <Markdown text={message.text} />
            )}
          </li>
        ))}
      </ol>
    </main>
  );
}
