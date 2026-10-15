"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center"><h1 className="text-2xl font-semibold">Kawan belum bisa dimuat.</h1><p role="status" aria-live="polite">Terjadi gangguan. Coba muat kembali.</p><Button className="min-h-11" onClick={reset}>Coba lagi</Button><Link href="/" className="underline">Kembali ke beranda</Link></main>;
}
