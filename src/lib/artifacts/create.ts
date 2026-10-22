/**
 * Lifecycle artefak (FIX-11): staging → ready, unduhan owner-checked, hapus.
 *
 * Urutan tulis sengaja baris-dulu-baru-byte: kegagalan menulis byte meninggalkan
 * baris `failed` yang bisa dibersihkan, bukan kartu sukses tanpa berkas.
 */

import { createHash, randomUUID } from "node:crypto";
import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";
import { deleteDocument, readDocument, saveDocument, storageRoot } from "@/lib/documents/storage";
import { mimeForFormat, sanitizeDisplayName, MAX_ARTIFACT_BYTES, type ArtifactFormat } from "./format";
import { ArtifactError, renderArtifactBytes, type ArtifactInput } from "./render";

/** Batas artefak per pengguna per 24 jam. */
const DAILY_QUOTA = 100;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type PublicArtifact = {
  id: string;
  format: string;
  displayName: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
  status: string;
  createdAt: Date;
  expiresAt: Date | null;
  downloadCount: number;
  parentArtifactId: string | null;
};

type ArtifactRow = PublicArtifact & { storageKey: string; deletedAt: Date | null };

function toPublic(row: ArtifactRow): PublicArtifact {
  return {
    id: row.id,
    format: row.format,
    displayName: row.displayName,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
    status: row.status,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    downloadCount: row.downloadCount,
    parentArtifactId: row.parentArtifactId,
  };
}

/** 404, bukan 403: jangan membocorkan keberadaan artefak milik orang lain. */
function notFound(): ApiError {
  return new ApiError({ status: STATUS.NOT_FOUND, code: "NOT_FOUND", message: "Artefak tidak ditemukan." });
}

export type CreateArtifactInput = {
  userId: string;
  chatId?: string | null;
  messageId?: string | null;
  displayName: string;
  input: ArtifactInput;
  parentArtifactId?: string | null;
};

export async function createArtifact(
  db: Db,
  args: CreateArtifactInput,
  root = storageRoot(),
): Promise<PublicArtifact> {
  const format = args.input.format as ArtifactFormat;
  const bytes = renderArtifactBytes(args.input);
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) throw new ArtifactError("TOO_LARGE");

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const used = await db.artifact.count({
    where: { userId: args.userId, deletedAt: null, createdAt: { gte: since } },
  });
  if (used >= DAILY_QUOTA) throw new ArtifactError("QUOTA_EXCEEDED");

  const id = `art_${randomUUID()}`;
  const displayName = sanitizeDisplayName(args.displayName, format);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  await db.artifact.create({
    data: {
      id,
      userId: args.userId,
      chatId: args.chatId ?? null,
      messageId: args.messageId ?? null,
      format,
      displayName,
      mime: mimeForFormat(format),
      sizeBytes: bytes.byteLength,
      sha256,
      storageKey: "",
      status: "staged",
      parentArtifactId: args.parentArtifactId ?? null,
      expiresAt: new Date(Date.now() + RETENTION_MS),
    },
  });

  try {
    const storageKey = await saveDocument(bytes, root);
    const row = await db.artifact.update({
      where: { id },
      data: { storageKey, status: "ready" },
    });
    return toPublic(row as ArtifactRow);
  } catch (err) {
    const row = await db.artifact.update({
      where: { id },
      data: {
        status: "failed",
        errorCode: err instanceof ArtifactError ? err.code : "WRITE_FAILED",
        errorMessage: err instanceof Error ? err.message.slice(0, 300) : null,
      },
    });
    return toPublic(row as ArtifactRow);
  }
}

export async function listArtifacts(db: Db, userId: string): Promise<PublicArtifact[]> {
  const rows = await db.artifact.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return (rows as ArtifactRow[]).map(toPublic);
}

export async function getArtifactForUser(db: Db, userId: string, id: string): Promise<PublicArtifact> {
  const row = await db.artifact.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw notFound();
  return toPublic(row as ArtifactRow);
}

export async function openArtifactBytes(
  db: Db,
  userId: string,
  id: string,
  root = storageRoot(),
): Promise<{ artifact: PublicArtifact; bytes: Buffer }> {
  const row = await db.artifact.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw notFound();
  const artifact = toPublic(row as ArtifactRow);
  if (artifact.status !== "ready") throw notFound();
  if (artifact.expiresAt && artifact.expiresAt.getTime() <= Date.now()) throw notFound();

  const bytes = await readDocument((row as ArtifactRow).storageKey, root);
  await db.artifact.update({ where: { id }, data: { downloadCount: { increment: 1 } } });
  return { artifact, bytes };
}

export async function deleteArtifact(db: Db, userId: string, id: string, root = storageRoot()): Promise<void> {
  const row = await db.artifact.findFirst({ where: { id, userId } });
  if (!row) return;
  const key = (row as ArtifactRow).storageKey;
  await db.artifact.update({ where: { id }, data: { deletedAt: new Date() } });
  if (key) await deleteDocument(key, root);
}
