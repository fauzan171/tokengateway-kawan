/**
 * Logger terstruktur JSON dengan redaksi terpusat (SDD-8.5).
 *
 * `redact` menyaring rekursif nilai apa pun sebelum ditulis; ia juga
 * dipakai ulang di tempat lain (ekspor, snapshot berbagi) sehingga
 * kanari rahasia (SDD-9.3) tidak lolos lewat jalur selain log.
 */

export const REDACTED = "[REDACTED]";

/** Kunci yang mengandung salah satu potongan ini diganti `[REDACTED]`. */
const SENSITIVE = ["key", "secret", "password", "token", "authorization"];

const MAX_DEPTH = 8;

function isSensitive(name: string): boolean {
  const lower = name.toLowerCase();
  return SENSITIVE.some((part) => lower.includes(part));
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (value === null || typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [name, item] of Object.entries(value as Record<string, unknown>)) {
    out[name] = isSensitive(name) ? REDACTED : redact(item, depth + 1);
  }
  return out;
}

export type LogFields = {
  requestId: string;
  /** Id/hash pengguna. Email tidak pernah masuk sini. */
  userId?: string;
  route: string;
  latencyMs: number;
  result: string;
};

export type LogRecord = LogFields & {
  level: "info" | "warn" | "error";
  /** Field tambahan; ikut melewati redaksi. */
  [extra: string]: unknown;
};

type Sink = (line: string) => void;

export function createLogger(sink: Sink = (line) => console.log(line)) {
  function emit(level: LogRecord["level"], fields: LogFields, extra?: Record<string, unknown>) {
    const record = redact({
      level,
      time: new Date().toISOString(),
      ...fields,
      ...extra,
    }) as LogRecord;
    sink(JSON.stringify(record));
  }

  return {
    info: (fields: LogFields, extra?: Record<string, unknown>) => emit("info", fields, extra),
    warn: (fields: LogFields, extra?: Record<string, unknown>) => emit("warn", fields, extra),
    error: (fields: LogFields, extra?: Record<string, unknown>) => emit("error", fields, extra),
  };
}

export const logger = createLogger();
