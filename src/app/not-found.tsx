import Link from "next/link";

export default function NotFound() {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center"><p className="text-muted-foreground">404</p><h1 className="text-2xl font-semibold">Halaman tidak ditemukan.</h1><Link href="/" className="inline-flex min-h-11 items-center underline">Kembali ke Kawan</Link></main>;
}
