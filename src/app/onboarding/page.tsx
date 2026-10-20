/**
 * Halaman onboarding "Hubungkan Gateway" (REQ-NT-01, SDD-7.2, SDD-7.6).
 *
 * Server Component tipis: memastikan pengguna sudah masuk, lalu menyerahkan
 * formulir ke Client Component. Tanpa sesi, pengguna dialihkan ke `/masuk`.
 *
 * Halaman ini sengaja TIDAK mengalihkan pengguna yang sudah punya koneksi
 * aktif: pengalihan itu tugas `src/app/page.tsx` (REQ-NT-01). Membiarkan
 * halaman ini selalu dapat dibuka membuat pengguna yang menyimpan koneksi
 * sebagai `draft` tetap punya jalan kembali untuk menguji koneksinya.
 */

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadConfig } from "@/lib/config/env";
import { ConnectGatewayForm } from "@/components/connect-gateway-form";
import { pageMetadata } from "@/lib/i18n/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("onboarding");
}

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/masuk");

  // Hanya URL yang dikirim ke klien. Key gateway bawaan tetap di server.
  const defaultBaseUrl = loadConfig().defaultGateway?.baseUrl ?? null;

  return <ConnectGatewayForm defaultBaseUrl={defaultBaseUrl} />;
}
