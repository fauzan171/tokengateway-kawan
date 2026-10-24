/**
 * Variabel prompt `{{nama}}` (REQ-NT-63). Murni dan tanpa impor server:
 * komponen klien memakainya untuk mengisi draft composer.
 */

const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Nama variabel unik, urut kemunculan pertama. */
export function extractVariables(body: string): string[] {
  const names: string[] = [];
  for (const match of body.matchAll(VARIABLE_RE)) {
    const name = match[1];
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * Isi variabel sekali jalan. `replace` dengan callback tidak memproses ulang
 * hasil penggantian, jadi nilai yang kebetulan berisi `{{isi}}` tetap utuh
 * dan tidak menjadi placeholder baru.
 */
export function applyVariables(body: string, values: Record<string, string>): string {
  return body.replace(VARIABLE_RE, (_match, name: string) => values[name] ?? "");
}
