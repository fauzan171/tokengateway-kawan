/**
 * Prompt tersimpan dan variabel `{{isi}}` (REQ-NT-62/63/64, SDD-2.2).
 *
 * Prompt milik pengguna (`userId` terisi) selalu difilter di level query.
 * Prompt bawaan (`userId` null) hanya terlihat bila `enabled`, dan tidak
 * pernah bisa dihapus pengguna: filter hapus memakai `userId` pengguna,
 * yang tidak akan pernah cocok dengan null.
 */

import { randomUUID } from "node:crypto";
import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";
import { extractVariables } from "./variables";

export { applyVariables, extractVariables } from "./variables";

const TITLE_MAX = 120;
const BODY_MAX = 8000;

export type PublicPrompt = {
  id: string;
  title: string;
  body: string;
  variables: string[];
  isDefault: boolean;
  enabled: boolean;
};

type PromptRow = {
  id: string;
  userId: string | null;
  title: string;
  body: string;
  enabled: boolean;
};

const PROMPT_FIELDS = { id: true, userId: true, title: true, body: true, enabled: true } as const;

function toPublicPrompt(row: PromptRow): PublicPrompt {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    variables: extractVariables(row.body),
    isDefault: row.userId === null,
    enabled: row.enabled,
  };
}

function normalizeText(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_PROMPT",
      message: `${field} harus berupa teks.`,
    });
  }
  const text = value.trim();
  if (text.length === 0 || text.length > max) {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_PROMPT",
      message: `${field} harus 1..${max} karakter.`,
    });
  }
  return text;
}

export async function listPrompts(db: Db, userId: string): Promise<PublicPrompt[]> {
  const rows = await db.prompt.findMany({
    where: { OR: [{ userId }, { userId: null, enabled: true }] },
    select: PROMPT_FIELDS,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toPublicPrompt);
}

export async function createPrompt(
  db: Db,
  input: { userId: string; title: unknown; body: unknown },
): Promise<PublicPrompt> {
  const title = normalizeText(input.title, "title", TITLE_MAX);
  const body = normalizeText(input.body, "body", BODY_MAX);

  const row = await db.prompt.create({
    data: {
      id: `prompt_${randomUUID()}`,
      userId: input.userId,
      title,
      body,
      variablesJson: JSON.stringify(extractVariables(body)),
    },
    select: PROMPT_FIELDS,
  });
  return toPublicPrompt(row);
}

export async function deletePrompt(
  db: Db,
  input: { userId: string; promptId: string },
): Promise<{ removed: boolean }> {
  // `userId` pengguna tidak akan cocok dengan prompt bawaan (null).
  const { count } = await db.prompt.deleteMany({
    where: { id: input.promptId, userId: input.userId },
  });
  return { removed: count > 0 };
}

export async function setPromptEnabled(
  db: Db,
  input: { promptId: string; enabled: unknown },
): Promise<{ updated: boolean }> {
  if (typeof input.enabled !== "boolean") {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_PROMPT",
      message: "enabled harus berupa boolean.",
    });
  }
  // Hanya prompt bawaan (userId null) yang bisa diaktifkan/dinonaktifkan admin.
  const { count } = await db.prompt.updateMany({
    where: { id: input.promptId, userId: null },
    data: { enabled: input.enabled },
  });
  return { updated: count > 0 };
}
