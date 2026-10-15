/**
 * Dipanggil Next sekali saat server start. Memuat registry konfigurasi di
 * sini membuat env yang hilang/salah menggagalkan start dengan pesan jelas,
 * bukan meledak jauh di dalam request pertama (SDD-1.5).
 */
export async function register() {
  const { loadConfig } = await import("./lib/config/env");
  loadConfig();
}
