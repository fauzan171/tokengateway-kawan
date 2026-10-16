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

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ConnectGatewayForm } from "@/components/connect-gateway-form";

export const metadata: Metadata = {
  title: "Hubungkan Gateway — Kawan",
  description: "Hubungkan gateway AI milikmu ke Kawan.",
};

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/masuk");

  return <ConnectGatewayForm />;
}
