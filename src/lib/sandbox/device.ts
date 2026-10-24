/**
 * Kemampuan perangkat dan layar (FIX-17).
 *
 * Aturannya satu kalimat: **tidak ada akses perangkat tanpa tindakan pengguna**.
 * Modul ini menyediakan bentuk data + validasi + batas, bukan pemanggilan API
 * browser. Komponen klien yang meminta izin, setelah klik.
 *
 * Yang sengaja tidak ada:
 *   - getUserMedia/getDisplayMedia otomatis saat halaman dimuat;
 *   - pengiriman User-Agent/IP/geolokasi ke model tanpa kegunaan;
 *   - klaim "mengontrol printer" atau "membaca filesystem": itu butuh aplikasi
 *     native, bukan halaman web.
 */

/** Izin yang boleh diminta, dan untuk apa. Tidak ada yang implisit. */
export type DevicePermission =
  | "microphone"
  | "camera"
  | "screen"
  | "geolocation"
  | "clipboard-read"
  | "clipboard-write"
  | "notifications";

/**
 * Status izin per perangkat. `unsupported` dan `denied` dibedakan: yang pertama
 * berarti API-nya tidak ada, yang kedua berarti pengguna menolak — fallback-nya
 * berbeda (manual vs. minta lagi nanti).
 */
export type DevicePermissionState = "granted" | "denied" | "prompt" | "unsupported";

export type DeviceAccessPlan = {
  permission: DevicePermission;
  /** Kenapa izin ini dibutuhkan; ditampilkan sebelum meminta. */
  reason: string;
  /** Alternatif bila izin ditolak/tidak didukung. Selalu ada. */
  fallback: string;
};

/** Rencana akses per perangkat; `fallback` wajib supaya penolakan bukan jalan buntu. */
export const DEVICE_PLANS: Record<DevicePermission, DeviceAccessPlan> = {
  microphone: {
    permission: "microphone",
    reason: "Merekam suara Anda untuk diubah menjadi teks.",
    fallback: "Unggah berkas audio yang sudah ada.",
  },
  camera: {
    permission: "camera",
    reason: "Mengambil foto untuk dilampirkan ke percakapan.",
    fallback: "Unggah berkas gambar dari perangkat.",
  },
  screen: {
    permission: "screen",
    reason: "Membagikan sebagian layar yang Anda pilih.",
    fallback: "Unggah tangkapan layar yang sudah ada.",
  },
  geolocation: {
    permission: "geolocation",
    reason: "Memberi konteks lokasi bila Anda meminta jawaban lokal.",
    fallback: "Tuliskan lokasi secara manual.",
  },
  "clipboard-read": {
    permission: "clipboard-read",
    reason: "Menempelkan teks yang sudah Anda salin.",
    fallback: "Tempel manual dengan Ctrl+V.",
  },
  "clipboard-write": {
    permission: "clipboard-write",
    reason: "Menyalin jawaban ke papan klip.",
    fallback: "Pilih teks lalu salin manual.",
  },
  notifications: {
    permission: "notifications",
    reason: "Memberi tahu saat tugas panjang selesai.",
    fallback: "Notifikasi tetap muncul di dalam aplikasi.",
  },
};

/** Fitur browser yang harus ada agar sebuah izin bisa diminta. */
export function isDeviceSupported(
  permission: DevicePermission,
  env: { hasMediaDevices: boolean; hasNotifications: boolean; hasGeolocation: boolean },
): boolean {
  switch (permission) {
    case "microphone":
    case "camera":
    case "screen":
      return env.hasMediaDevices;
    case "geolocation":
      return env.hasGeolocation;
    case "notifications":
      return env.hasNotifications;
    case "clipboard-read":
    case "clipboard-write":
      // Clipboard API tidak punya flag fitur yang seragam; dianggap ada lalu
      // kegagalan runtime jatuh ke fallback manual.
      return true;
  }
}

/**
 * Batas berbagi layar. Redaksi/preview terjadi SEBELUM frame dikirim, dan
 * rekaman dihentikan saat komponen dibongkar.
 */
export const SCREEN_SHARE_LIMITS = {
  maxWidth: 1920,
  maxHeight: 1080,
  /** Frame per detik saat pratinjau; berbagi layar bukan perekam video. */
  maxFps: 5,
  maxDurationSeconds: 300,
} as const;

/**
 * Geolokasi minimum: hanya kota/negara, tanpa koordinat presisi, dan hanya bila
 * pengguna memintanya. Koordinat mentah tidak pernah diteruskan ke model.
 */
export type CoarseLocation = { city?: string; region?: string; country?: string };

export function coarsenLocation(input: {
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
}): CoarseLocation {
  // Koordinat sengaja TIDAK diteruskan: pembulatan tetap mengidentifikasi rumah.
  const result: CoarseLocation = {};
  if (input.city?.trim()) result.city = input.city.trim().slice(0, 80);
  if (input.region?.trim()) result.region = input.region.trim().slice(0, 80);
  if (input.country?.trim()) result.country = input.country.trim().slice(0, 80);
  return result;
}

/** User-Agent minimum: hanya keluarga browser, tanpa versi lengkap/OS. */
export function minimalUserAgent(raw: string): string {
  const text = raw.toLowerCase();
  if (text.includes("edg/")) return "Edge";
  if (text.includes("firefox/")) return "Firefox";
  if (text.includes("chrome/") || text.includes("crios/")) return "Chrome";
  if (text.includes("safari/")) return "Safari";
  return "browser lain";
}
