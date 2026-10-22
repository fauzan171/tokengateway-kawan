/** Skema dokumen terstruktur (FIX-12): satu-satunya bentuk yang boleh dikirim model. */

import { ArtifactError } from "./render";

export type DocBlock =
  | { type: "heading"; text: string; level?: 1 | 2 | 3 }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "code"; text: string; language?: string };

export type DocSchema = { title: string; blocks: DocBlock[] };

const MAX_BLOCKS = 500;
const MAX_TEXT = 20_000;

const clip = (text: string) => text.slice(0, MAX_TEXT);

export function parseDocSchema(value: unknown): DocSchema {
  if (typeof value !== "object" || value === null) throw new ArtifactError("INVALID_DOC_SCHEMA");
  const raw = value as Record<string, unknown>;
  if (typeof raw.title !== "string" || !raw.title.trim()) throw new ArtifactError("INVALID_DOC_SCHEMA");
  if (!Array.isArray(raw.blocks)) throw new ArtifactError("INVALID_DOC_SCHEMA");
  if (raw.blocks.length > MAX_BLOCKS) throw new ArtifactError("INVALID_DOC_SCHEMA");

  const blocks: DocBlock[] = [];
  for (const item of raw.blocks) {
    if (typeof item !== "object" || item === null) continue;
    const b = item as Record<string, unknown>;
    switch (b.type) {
      case "heading":
        if (typeof b.text !== "string") continue;
        blocks.push({ type: "heading", text: clip(b.text), level: b.level === 2 || b.level === 3 ? b.level : 1 });
        break;
      case "paragraph":
        if (typeof b.text !== "string") continue;
        blocks.push({ type: "paragraph", text: clip(b.text) });
        break;
      case "bullets": {
        if (!Array.isArray(b.items)) continue;
        const items = b.items.filter((i): i is string => typeof i === "string").map(clip);
        if (!items.length) continue;
        blocks.push({ type: "bullets", items });
        break;
      }
      case "table": {
        if (!Array.isArray(b.headers)) continue;
        const headers = b.headers.filter((h): h is string => typeof h === "string");
        if (!headers.length || !Array.isArray(b.rows)) continue;
        const rows = (b.rows as unknown[]).filter(
          (r): r is string[] => Array.isArray(r) && r.length === headers.length,
        );
        blocks.push({ type: "table", headers, rows });
        break;
      }
      case "code":
        if (typeof b.text !== "string") continue;
        blocks.push({
          type: "code",
          text: clip(b.text),
          ...(typeof b.language === "string" ? { language: b.language } : {}),
        });
        break;
    }
  }
  return { title: raw.title.trim(), blocks };
}
