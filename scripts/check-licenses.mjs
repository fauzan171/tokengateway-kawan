#!/usr/bin/env node
/**
 * Pemeriksa lisensi dependensi (WP-NT-P10-07).
 *
 * Membaca `package-lock.json`: hasilnya sama di laptop dan CI, dan tidak butuh
 * pemasangan dependensi. SEMUA paket di lockfile ikut diperiksa, bukan hanya
 * dependensi langsung — yang menular ke kode kita biasanya justru paket
 * transitif.
 *
 * Sebagian paket tidak menulis `license` di lockfile (`khroma`, `seq-queue`),
 * jadi nama field itu dicari juga di `package.json` hasil `npm ci`. Bila
 * keduanya kosong, paket dilaporkan sebagai galat: "tidak tahu" bukan "aman".
 *
 * Daftar tolak sengaja sempit: hanya lisensi yang menular ke kode kita.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DENY = [/^AGPL/i, /^GPL-?[23]/i, /^SSPL/i, /^CPAL/i, /^EUPL/i, /^OSL/i];

/**
 * Paket yang tidak menulis `license` di manifest mana pun tetapi membawa
 * berkas `LICENSE` berisi MIT. Dicatat eksplisit supaya nilai yang dipakai
 * terlihat di diff, bukan ditebak dari isi berkas.
 */
const LICENSES_OVERRIDE = { khroma: "MIT", "seq-queue": "MIT" };

const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const entries = Object.entries(lock.packages).filter(([path]) => path !== "");

/** Lisensi dari lockfile, atau dari `node_modules` bila lockfile tidak menulisnya. */
function licenseOf(path, meta) {
  if (typeof meta.license === "string" && meta.license !== "") return meta.license;
  const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
  if (LICENSES_OVERRIDE[name]) return LICENSES_OVERRIDE[name];
  const manifest = join(process.cwd(), path, "package.json");
  if (!existsSync(manifest)) return "";
  try {
    const pkg = JSON.parse(readFileSync(manifest, "utf8"));
    if (typeof pkg.license === "string") return pkg.license;
    if (Array.isArray(pkg.licenses)) return pkg.licenses.map((entry) => entry.type ?? entry).join(" OR ");
    return "";
  } catch {
    return "";
  }
}

const denied = [];
const missing = [];
/** Sebaran lisensi untuk catatan review (docs/license-review.md). */
const sebaran = new Map();

for (const [path, meta] of entries) {
  const license = licenseOf(path, meta);
  if (!license) missing.push(path);
  else if (DENY.some((pattern) => pattern.test(license))) denied.push(`${path}: ${license}`);
  if (license) sebaran.set(license, (sebaran.get(license) ?? 0) + 1);
}

for (const [title, rows] of [
  ["Paket tanpa field lisensi", missing],
  ["Lisensi ditolak", denied],
]) {
  if (rows.length === 0) continue;
  console.error(`${title} (${rows.length}):`);
  for (const row of rows) console.error(`  - ${row}`);
}

if (missing.length > 0 || denied.length > 0) process.exit(1);

console.log(`Lisensi dependensi: ${entries.length} paket, 0 ditolak, 0 tanpa lisensi.`);
console.log(`Lisensi unik (${sebaran.size}):`);
for (const [license, jumlah] of [...sebaran].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(jumlah).padStart(5)}  ${license}`);
}
