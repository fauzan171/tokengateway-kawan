/**
 * Kebijakan keluar / anti-SSRF (SDD-5.3, WP-NT-P2-04).
 *
 * Satu modul yang memutuskan apakah sebuah alamat boleh dihubungi keluar.
 * Sebelumnya `src/lib/api/http.ts` memeriksa host secara literal saja, sehingga
 * nama yang menunjuk ke alamat privat lewat DNS lolos. Modul ini menutup celah
 * itu dengan me-resolve nama lebih dulu, lalu memeriksa alamat HASIL RESOLUSI.
 *
 * Lima aturan SDD-5.3 yang ditegakkan di sini:
 *
 * 1. Skema hanya `https`; `http` hanya bila operator menyalakan
 *    `allowInsecureHttp` (bawaan menolak — gagal ke arah aman).
 * 2. Resolusi DNS sebelum koneksi; alamat loopback, link-local, dan rentang
 *    metadata cloud ditolak. Yang diperiksa adalah alamat hasil resolusi, bukan
 *    hanya literal.
 * 3. Redirect lintas host ditolak (`assertRedirectAllowed`).
 * 4. Batas waktu dan ukuran respons tersedia sebagai `OUTBOUND_LIMITS`
 *    (lihat catatan penegakan di bawah).
 * 5. Alamat dengan kredensial tertanam (`user:pass@`) ditolak.
 *
 * Allowlist operator bersifat PRESISI (`host` atau `host:port`), bukan cara
 * melonggarkan aturan global: tanpa isi, seluruh rentang privat tetap ditolak.
 *
 * Catatan penegakan batas (jujur): batas waktu koneksi/total adalah tanggung
 * jawab pemanggil (`fetchJson` sudah memakai timeout), dan batas ukuran
 * respons belum dapat ditegakkan lewat `fetch` biasa karena modul ini tidak
 * membaca body. `OUTBOUND_LIMITS` menetapkan nilainya supaya klien gateway
 * (WP-NT-P2-05) menerapkannya secara konsisten.
 *
 * Catatan TOCTOU: pemeriksaan me-resolve nama sekali, lalu `fetch` me-resolve
 * ULANG saat menyambung, sehingga nama ber-TTL pendek masih bisa berpindah ke
 * alamat privat di antara dua resolusi (DNS rebinding). Celah itu ditutup di
 * `fetchOutbound`: alamat hasil resolusi yang sudah diperiksa disematkan ke
 * koneksi lewat `dispatcherFor`, jadi tidak ada resolusi kedua. Pemanggil yang
 * memakai `fetch` sendiri (bukan `fetchOutbound`) memakai
 * `resolvePinnedTarget` + `dispatcherFor` agar mendapat jaminan yang sama.
 */

import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { Agent } from "undici";
import { ApiError, STATUS } from "@/lib/api/errors";

/** Satu alamat hasil resolusi. `family` 4 atau 6, seperti `dns.lookup`. */
export type ResolvedAddress = { address: string; family: 4 | 6 };

/**
 * Sumber alamat untuk sebuah hostname.
 *
 * Disuntik lewat opsi agar tes tidak bergantung DNS jaringan nyata; produksi
 * memakai `dns.lookup` sistem (lihat `defaultResolver`).
 */
export type HostResolver = (hostname: string) => Promise<readonly ResolvedAddress[]>;

export type OutboundPolicyOptions = {
  /** Dari `Config.allowInsecureHttp` (SDD-5.3). */
  allowInsecureHttp: boolean;
  /** Dari `Config.outboundAllowlist` (SDD-5.3); presisi `host` atau `host:port`. */
  allowlist: readonly string[];
  /** Override resolver untuk tes. Produksi tidak perlu mengisinya. */
  resolve?: HostResolver;
};

/**
 * Kebijakan paling ketat, dipakai bila pemanggil tidak punya akses konfigurasi:
 * hanya `https`, tanpa allowlist. Bukan pelonggaran apa pun.
 */
export const DEFAULT_OUTBOUND_OPTIONS: OutboundPolicyOptions = {
  allowInsecureHttp: false,
  allowlist: [],
};

/**
 * Batas panggilan keluar (SDD-5.3 butir 4). Nilai ini kontrak, bukan saran:
 * klien gateway harus memakai `totalTimeoutMs` dan `maxResponseBytes` yang sama
 * agar perilaku seragam. `connectTimeoutMs` dibatasi di lapisan koneksi.
 */
export const OUTBOUND_LIMITS = {
  connectTimeoutMs: 5_000,
  totalTimeoutMs: 15_000,
  /** Jeda maksimum antar potongan stream. Bukan durasi total: model reasoning
   *  butuh puluhan detik untuk menjawab penuh, dan memotongnya di tengah
   *  menghasilkan TIMEOUT palsu. */
  streamIdleTimeoutMs: 90_000,
  maxResponseBytes: 10 * 1024 * 1024,
} as const;

/**
 * Host yang selalu ditolak walau tidak di-resolve.
 *
 * Ini jaring pengaman literal: nama metadata cloud yang lazim dan `localhost`.
 * Nama yang menunjuk ke alamat privat tetap tertangkap lewat pemeriksaan
 * resolusi, jadi daftar ini tidak perlu lengkap — ia hanya menutup kasus yang
 * resolusinya bisa gagal (mis. `metadata.google.internal` di jaringan non-GCP).
 */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
]);

/**
 * Rentang alamat yang tidak boleh dihubungi.
 *
 * `BlockList` sudah menangani IPv4-mapped IPv6 (`::ffff:127.0.0.1`) dengan
 * mencocokkannya ke subnet IPv4, jadi satu daftar cukup untuk dua keluarga.
 * Rentang privat (10/8, 172.16/12, 192.168/16), loopback, link-local, dan
 * metadata (169.254/16, `fd00:ec2::254`) termasuk; `100.64/10` (CGNAT) dan
 * `0.0.0.0/8` ikut ditutup karena sama-sama tidak boleh jadi tujuan keluar.
 */
const BLOCKED_RANGES = new BlockList();
BLOCKED_RANGES.addSubnet("0.0.0.0", 8, "ipv4");
BLOCKED_RANGES.addSubnet("10.0.0.0", 8, "ipv4");
BLOCKED_RANGES.addSubnet("100.64.0.0", 10, "ipv4");
BLOCKED_RANGES.addSubnet("127.0.0.0", 8, "ipv4");
BLOCKED_RANGES.addSubnet("169.254.0.0", 16, "ipv4");
BLOCKED_RANGES.addSubnet("172.16.0.0", 12, "ipv4");
BLOCKED_RANGES.addSubnet("192.168.0.0", 16, "ipv4");
BLOCKED_RANGES.addSubnet("224.0.0.0", 4, "ipv4");
BLOCKED_RANGES.addSubnet("240.0.0.0", 4, "ipv4");
BLOCKED_RANGES.addAddress("::", "ipv6");
BLOCKED_RANGES.addAddress("::1", "ipv6");
BLOCKED_RANGES.addSubnet("fc00::", 7, "ipv6");
BLOCKED_RANGES.addSubnet("fe80::", 10, "ipv6");
BLOCKED_RANGES.addSubnet("ff00::", 8, "ipv6");
BLOCKED_RANGES.addAddress("fd00:ec2::254", "ipv6");

/** Galat kebijakan, seragam dengan bentuk SDD-3.1 yang dipakai pemanggil lain. */
function badUrl(message: string): ApiError {
  return new ApiError({ status: STATUS.UNPROCESSABLE, code: "BAD_URL", message });
}

function blocked(): ApiError {
  return badUrl("Alamat tujuan tidak diizinkan.");
}

/**
 * Menormalkan hostname untuk pemeriksaan dan pencocokan allowlist.
 *
 * Melepas kurung siku IPv6, menurunkan huruf (`URL` sudah meng-encode IDN), dan
 * membuang satu titik akar di ujung. Titik ujung penting: `localhost.` adalah
 * FQDN yang sama dengan `localhost`, jadi tanpa normalisasi ini ia akan lolos
 * daftar blokir literal.
 */
function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
}

/**
 * Apakah alamat ini termasuk rentang terlarang.
 *
 * Alamat yang tidak dikenali `isIP` dianggap terlarang (gagal ke arah aman):
 * lebih baik menolak sesuatu yang tidak bisa diklasifikasi daripada
 * meloloskannya tanpa pemeriksaan.
 */
export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  return BLOCKED_RANGES.check(address, family === 6 ? "ipv6" : "ipv4");
}

/** Satu entri allowlist yang sudah dipecah jadi host dan port (bila ada). */
type AllowEntry = { host: string; port: string | null };

/**
 * Memecah entri allowlist `host` atau `host:port`.
 *
 * Literal IPv6 ditulis dalam kurung siku (`[::1]:8080`) supaya titik dua port
 * tidak tertukar dengan titik dua alamat. Entri yang tidak masuk akal
 * dikembalikan apa adanya sebagai host tanpa port; ia sekadar tidak akan cocok,
 * bukan membuat seluruh allowlist gagal.
 */
function parseAllowEntry(raw: string): AllowEntry {
  const value = raw.trim().toLowerCase();
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end === -1) return { host: value, port: null };
    const host = value.slice(1, end);
    const rest = value.slice(end + 1);
    if (!rest.startsWith(":")) return { host, port: null };
    return { host, port: rest.slice(1) };
  }
  const colon = value.lastIndexOf(":");
  if (colon !== -1 && value.indexOf(":") === colon && /^\d+$/.test(value.slice(colon + 1))) {
    return { host: value.slice(0, colon), port: value.slice(colon + 1) };
  }
  return { host: value, port: null };
}

/**
 * Apakah host:port cocok dengan salah satu entri allowlist.
 *
 * Entri tanpa port cocok untuk port apa pun; entri ber-port hanya cocok pada
 * port itu. Inilah yang membuat `10.0.0.5:8080` tidak membuka `10.0.0.6` dan
 * tidak membuka port lain di host yang sama.
 */
function allowlistMatches(hostname: string, port: string, allowlist: readonly string[]): boolean {
  for (const raw of allowlist) {
    const entry = parseAllowEntry(raw);
    if (entry.host !== hostname) continue;
    if (entry.port !== null && entry.port !== port) continue;
    return true;
  }
  return false;
}

/** Resolver produksi: `dns.lookup` sistem, termasuk `/etc/hosts`. */
const defaultResolver: HostResolver = async (hostname) => {
  const results = await lookup(hostname, { all: true });
  return results.map((entry) => ({
    address: entry.address,
    family: entry.family === 6 ? 6 : 4,
  }));
};

/**
 * Memastikan alamat boleh dihubungi, atau melempar `ApiError` (422 BAD_URL).
 *
 * Mengembalikan `URL` yang sudah diparse saat lolos, sehingga pemanggil tidak
 * memparse ulang.
 *
 * Bila resolusi DNS gagal (nama tidak ada), alamat DIBIARKAN lewat: tidak ada
 * alamat privat yang bisa dicapai, dan `fetch` akan gagal dengan galat
 * transportnya sendiri. Ini menjaga pemeriksaan alamat tidak mengubah bentuk
 * galat transport yang sudah jadi kontrak `fetchJson`. Nama yang berhasil
 * di-resolve tetap diperiksa seluruh alamatnya, dan satu saja yang terlarang
 * sudah cukup untuk menolak.
 */
export async function assertOutboundAllowed(
  rawUrl: string,
  options: OutboundPolicyOptions,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw badUrl("Alamat tidak valid.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw badUrl("Hanya http dan https yang didukung.");
  }

  if (url.protocol === "http:" && !options.allowInsecureHttp) {
    throw badUrl("Alamat http:// tanpa TLS tidak diizinkan.");
  }

  if (url.username !== "" || url.password !== "") {
    throw badUrl("Alamat tidak boleh memuat kredensial (bentuk user:pass@host).");
  }

  const hostname = normalizeHostname(url.hostname);

  // Allowlist operator menang lebih dulu: gateway privat on-premise memang
  // berada di rentang yang sebaliknya ditolak. Presisi host:port dijaga
  // `allowlistMatches`, bukan dilonggarkan di sini.
  if (allowlistMatches(hostname, url.port, options.allowlist)) return url;

  const literalFamily = isIP(hostname);
  if (literalFamily !== 0) {
    if (isBlockedAddress(hostname)) throw blocked();
    return url;
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) throw blocked();

  const resolve = options.resolve ?? defaultResolver;
  let addresses: readonly ResolvedAddress[];
  try {
    addresses = await resolve(hostname);
  } catch {
    return url;
  }

  for (const { address } of addresses) {
    if (isBlockedAddress(address)) throw blocked();
  }

  return url;
}

/**
 * Alamat hasil resolusi yang sudah lolos kebijakan, disematkan ke koneksi.
 *
 * `assertOutboundAllowed` me-resolve nama sekali, lalu `fetch` me-resolve ULANG
 * saat menyambung: nama ber-TTL pendek bisa berpindah ke alamat privat di antara
 * keduanya (DNS rebinding). Percobaan alamat di sini diambil dari hasil resolusi
 * yang SUDAH diperiksa, dan `dispatcherFor` menyuntikkannya sebagai `lookup`
 * kustom sehingga tidak ada resolusi kedua.
 *
 * Allowlist operator dilewati: gateway on-premise memang berada di rentang yang
 * sebaliknya ditolak, dan alamatnya sudah sengaja dipercaya.
 */
export type PinnedTarget = { url: URL; addresses: readonly ResolvedAddress[] };

export async function resolvePinnedTarget(
  url: URL,
  options: OutboundPolicyOptions,
): Promise<PinnedTarget> {
  const hostname = normalizeHostname(url.hostname);
  if (allowlistMatches(hostname, url.port, options.allowlist)) return { url, addresses: [] };
  if (isIP(hostname) !== 0) return { url, addresses: [] };
  if (BLOCKED_HOSTNAMES.has(hostname)) throw blocked();

  const resolve = options.resolve ?? defaultResolver;
  try {
    return { url, addresses: await resolve(hostname) };
  } catch {
    // Resolusi gagal di sini sama seperti di `assertOutboundAllowed`: biarkan
    // `fetch` yang melaporkan galat transportnya sendiri.
    return { url, addresses: [] };
  }
}

/**
 * Dispatcher yang menyematkan alamat ke koneksi, atau `undefined` bila tidak
 * ada yang perlu disematkan (allowlist, literal IP, resolusi gagal).
 *
 * Hanya alamat yang sudah lolos `assertOutboundAllowed` yang sampai ke sini,
 * jadi tidak ada pemeriksaan ulang di jalur koneksi — yang dijaga adalah
 * alamatnya tidak berubah lagi.
 */
export function dispatcherFor(target: PinnedTarget): Agent | undefined {
  if (target.addresses.length === 0) return undefined;

  const pinned = target.addresses;
  const lookupPinned = (
    _hostname: string,
    options: { all?: boolean } | ((...args: never[]) => void),
    callback?: (...args: never[]) => void,
  ): void => {
    // undici memanggil `lookup` dengan `all: true` dan mengharapkan daftar;
    // alamat di sini identik dengan yang sudah lulus kebijakan.
    if (typeof options === "function") {
      (options as (err: null, address: string, family: 4 | 6) => void)(null, pinned[0].address, pinned[0].family);
      return;
    }
    const done = callback as (err: null, result: unknown, family?: 4 | 6) => void;
    if (options.all) {
      done(null, pinned.map((entry) => ({ address: entry.address, family: entry.family })));
      return;
    }
    done(null, pinned[0].address, pinned[0].family);
  };

  return new Agent({
    connect: { lookup: lookupPinned as never },
    // Tiap permintaan keluar membawa dispatcher sendiri; soket tidak perlu
    // hidup lebih lama dari satu respons.
    keepAliveTimeout: 1_000,
  });
}

/**
 * Memvalidasi satu lompatan redirect (SDD-5.3 butir 3).
 *
 * Redirect hanya boleh menuju origin yang sama (skema, host, dan port). Target
 * tetap divalidasi ulang lewat `assertOutboundAllowed`, sehingga host yang sama
 * tetapi menunjuk ke alamat privat tetap tertolak. Redirect lintas host
 * dilempar sebagai 422 BAD_URL.
 */
export async function assertRedirectAllowed(
  fromUrl: string,
  toUrl: string,
  options: OutboundPolicyOptions,
): Promise<URL> {
  const from = new URL(fromUrl);
  const to = await assertOutboundAllowed(toUrl, options);

  const sameOrigin =
    from.protocol === to.protocol &&
    normalizeHostname(from.hostname) === normalizeHostname(to.hostname) &&
    from.port === to.port;

  if (!sameOrigin) {
    throw badUrl("Redirect ke host lain tidak diizinkan.");
  }

  return to;
}

/** Status yang membawa header `Location` dan karena itu harus diperiksa. */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Lompatan redirect maksimum sebelum dianggap lingkaran. */
const MAX_REDIRECTS = 3;

/**
 * `fetch` keluar dengan redirect DIMATIKAN dan divalidasi sendiri.
 *
 * `fetch` bawaan mengikuti redirect otomatis sesudah URL awal lolos kebijakan,
 * sehingga gateway yang dikendalikan pengguna bisa menembak alamat privat lewat
 * `Location` (SDD-5.3 butir 3). Di sini setiap lompatan diperiksa
 * `assertRedirectAllowed` LEBIH DULU; target hanya dihubungi bila lolos.
 *
 * Permintaan non-GET/HEAD dengan body (POST form, JSON, stream) TIDAK diikuti:
 * mengulanginya ke alamat lain berarti mengirim ulang kredensial dan isi ke
 * tujuan yang belum tentu sama. Redirect semacam itu ditolak.
 *
 * `url` sudah divalidasi pemanggil lewat `assertOutboundAllowed` (mereka
 * membutuhkannya untuk galat kebijakan yang spesifik).
 */
export async function fetchOutbound(
  url: URL,
  init: RequestInit,
  options: OutboundPolicyOptions,
  maxRedirects: number = MAX_REDIRECTS,
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const redirectable = method === "GET" || method === "HEAD";

  let current = url;
  let pinned = await resolvePinnedTarget(current, options);
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    // Alamat yang sudah lulus kebijakan disematkan ke koneksi; setiap lompatan
    // redirect me-resolve ulang HANYA setelah lolos `assertRedirectAllowed`.
    const dispatcher = dispatcherFor(pinned);
    const response = await fetch(current, {
      ...init,
      redirect: "manual",
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);
    if (!REDIRECT_STATUSES.has(response.status)) {
      // Dispatcher dibiarkan hidup selama body dibaca (stream); soketnya
      // menutup sendiri karena `keepAliveTimeout` sangat pendek.
      return response;
    }

    // Body 3xx dibuang; tidak ada lagi yang memakai soket ini, jadi putuskan
    // sekarang alih-alih menunggu idle timeout.
    await dispatcher?.destroy().catch(() => {});

    const location = response.headers.get("location");
    // Body 3xx dibuang; ia bukan isi yang dipakai pemanggil, dan membiarkannya
    // terbuka menahan soket sampai timeout.
    await response.body?.cancel().catch(() => {});

    if (!redirectable) throw badUrl("Redirect pada permintaan ini tidak diizinkan.");
    if (!location) throw badUrl("Redirect tanpa alamat tujuan.");

    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      throw badUrl("Alamat redirect tidak valid.");
    }
    current = await assertRedirectAllowed(current.toString(), next.toString(), options);
    pinned = await resolvePinnedTarget(current, options);
  }

  throw badUrl("Terlalu banyak redirect.");
}
