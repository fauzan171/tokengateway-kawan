/**
 * Normalisasi dan validasi base URL gateway (REQ-NT-03, SDD-3.2).
 *
 * Modul ini murni: tidak menyentuh jaringan, database, atau konfigurasi global.
 * Tugasnya hanya memutuskan apakah sebuah base URL layak dipakai, dan
 * mengubahnya ke bentuk kanonik sebelum disimpan di kolom `Connection.baseUrl`.
 *
 * Tiga hal yang dijamin modul ini:
 *
 * 1. **Trailing slash dibuang** — berulang, bukan hanya satu (`.../v1///` →
 *    `.../v1`), supaya penggabungan path tidak pernah menghasilkan `//`.
 * 2. **`v1` tidak digandakan** — dan juga tidak ditambahkan. Kawan tidak
 *    berasumsi gateway selalu memakai prefiks `v1`, jadi base URL dibiarkan
 *    apa adanya; yang dilarang adalah munculnya `/v1/v1/`. Karena `v1` tidak
 *    pernah disisipkan, bentuk itu mustahil terbentuk.
 * 3. **Skema divalidasi** — hanya `http`/`https`, dan `http` tanpa TLS hanya
 *    bila operator menyalakan `allowInsecureHttp` (SDD-5.3).
 *
 * Yang BUKAN tugas modul ini: kebijakan keluar/SSRF (allowlist host, penolakan
 * rentang privat, endpoint metadata) ditangani modul kebijakan terpisah
 * (SDD-5.3, WP-NT-P2-04). Normalisasi tidak memblokir alamat privat.
 */

/** Sebab kegagalan, konsisten dengan `reason` pada SDD-3.2/3.3. */
export type NormalizeReason = "BAD_URL" | "BAD_SCHEME" | "BAD_HOST";

/**
 * Opsi normalisasi. `allowInsecureHttp` berasal dari
 * `Config.allowInsecureHttp` (SDD-5.3).
 *
 * Bila opsi tidak diberikan sama sekali, bawaannya menolak `http://` — gagal
 * ke arah yang aman, bukan ke arah yang permisif.
 */
export type NormalizeOptions = {
  allowInsecureHttp?: boolean;
};

/** Hasil normalisasi. Saat gagal, `message` siap ditampilkan ke pengguna. */
export type NormalizeResult =
  | { ok: true; url: string }
  | { ok: false; reason: NormalizeReason; message: string };

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

/**
 * Satu label DNS yang sah: huruf/angka di ujung, tanda hubung hanya di tengah.
 * Regex ini menolak label kosong, `-x`, dan `x-`, sehingga host seperti
 * `.com` atau `-x.com` tidak lolos.
 */
const HOSTNAME_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Host khusus yang bukan nama DNS tetapi sah untuk gateway lokal. */
const LOCAL_HOSTNAMES = new Set(["localhost"]);

function fail(reason: NormalizeReason, message: string): NormalizeResult {
  return { ok: false, reason, message };
}

/**
 * Memvalidasi host hasil parse `URL`.
 *
 * `URL` sudah menormalkan host ke huruf kecil (dan meng-encode IDN ke punycode),
 * jadi di sini cukup memastikan bentuknya masuk akal. Dua kasus dibedakan:
 * literal IPv6 (diapit `[...]`, sintaksnya sudah diperiksa `URL`) dan nama
 * host biasa yang tiap labelnya harus sah.
 */
function isValidHostname(hostname: string): boolean {
  if (hostname === "") return false;

  // Literal IPv6, mis. `[::1]` atau `[2001:db8::1]`.
  if (hostname.startsWith("[")) {
    return hostname.endsWith("]") && hostname.length > 2;
  }

  // Titik dua di luar literal IPv6 berarti host cacat (mis. `contoh.id:abc`).
  if (hostname.includes(":")) return false;

  if (LOCAL_HOSTNAMES.has(hostname)) return true;

  const labels = hostname.split(".");
  // Label kosong menangkap host seperti `.com`, `contoh..id`, dan `contoh.id.`.
  if (labels.some((label) => label === "")) return false;
  return labels.every((label) => HOSTNAME_LABEL_RE.test(label));
}

/**
 * Menormalkan base URL gateway.
 *
 * Tahan terhadap `null`, `undefined`, string kosong, dan spasi berlebih —
 * selalu mengembalikan hasil, tidak pernah melempar.
 *
 * Aturan bentuk:
 * - Spasi di ujung dipangkas.
 * - Skema dan host dinormalkan `URL` (huruf kecil); path TIDAK diubah karena
 *   gateway bisa memakai path dasar yang peka huruf besar/kecil.
 * - Trailing slash dibuang berulang; query dan fragmen DITOLAK — base URL
 *   adalah alamat dasar, bukan URL permintaan, jadi `?x=1` tidak bermakna.
 * - Kredensial tertanam (`user:pass@host`) ditolak: kunci API diisi di kolom
 *   terpisah dan tidak boleh ikut tercatat di `baseUrl`.
 */
export function normalizeBaseUrl(
  raw: string | null | undefined,
  options: NormalizeOptions = {},
): NormalizeResult {
  const allowInsecureHttp = options.allowInsecureHttp === true;

  if (typeof raw !== "string" || raw.trim() === "") {
    return fail("BAD_URL", "Base URL wajib diisi.");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return fail(
      "BAD_URL",
      "Base URL bukan URL yang sah. Contoh: https://api.tokengateway.ai.id/v1",
    );
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return fail(
      "BAD_SCHEME",
      "Base URL harus memakai skema http atau https. Contoh: https://api.tokengateway.ai.id/v1",
    );
  }

  if (parsed.protocol === "http:" && !allowInsecureHttp) {
    return fail(
      "BAD_SCHEME",
      "Base URL http:// tanpa TLS tidak diizinkan. Gunakan https://, atau minta operator mengizinkan http untuk jaringan lokal.",
    );
  }

  if (!isValidHostname(parsed.hostname)) {
    return fail("BAD_HOST", "Host pada base URL tidak sah.");
  }

  if (parsed.username !== "" || parsed.password !== "") {
    return fail(
      "BAD_URL",
      "Base URL tidak boleh memuat kredensial (bentuk user:pass@host). Kunci API diisi di kolom terpisah.",
    );
  }

  if (parsed.search !== "") {
    return fail(
      "BAD_URL",
      "Base URL tidak boleh memuat query. Isi hanya alamat dasarnya, mis. https://api.tokengateway.ai.id/v1",
    );
  }

  if (parsed.hash !== "") {
    return fail("BAD_URL", "Base URL tidak boleh memuat fragmen (#...).");
  }

  // Path "/" (tanpa path) dan "/v1///" sama-sama berakhir tanpa slash.
  const path = parsed.pathname.replace(/\/+$/, "");
  return { ok: true, url: `${parsed.protocol}//${parsed.host}${path}` };
}

/**
 * Menyusun URL daftar model dari base URL yang SUDAH dinormalisasi (REQ-NT-02).
 *
 * Endpoint-nya adalah `{baseUrl}/models`: prefiks `v1` tidak pernah
 * ditambahkan, jadi base URL tanpa `v1` tetap menghasilkan `{base}/models`,
 * dan base URL yang sudah berakhiran `v1` menghasilkan `{base}/models` — bukan
 * `{base}/v1/v1/models`. Karena `v1` tidak pernah disisipkan, `/v1/v1/` tidak
 * mungkin muncul.
 *
 * Trailing slash tetap dibuang di sini sebagai jaring pengaman bila pemanggil
 * melewatkan hasil normalisasi; base URL kosong menghasilkan string kosong,
 * bukan URL setengah jadi.
 */
export function buildModelsUrl(baseUrl: string): string {
  if (typeof baseUrl !== "string") return "";
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (base === "") return "";
  return `${base}/models`;
}
