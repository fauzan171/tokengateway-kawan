/**
 * Persetujuan satu-pakai (FIX-20, SDD TaskInteraction).
 *
 * Aturan yang ditegakkan di sini:
 *   - approval dibuat dengan digest atas aksi + target + payload + revisi
 *     kebijakan; perubahan satu byte pun membatalkan approval lama;
 *   - pemakaian bersifat atomik (`status=pending` → `accepted`/`rejected` dalam
 *     satu UPDATE dengan WHERE status); dua pemakaian berbarengan membuat satu
 *     kalah dan mendapat "sudah dipakai";
 *   - pemakaian menjawab kedaluwarsa atau bukan pending dengan 409, bukan
 *     dengan mengeksekusi lalu menyesal;
 *   - output gateway/tool TIDAK PERNAH bisa menyetujui: hanya sesi pengguna
 *     yang terautentikasi yang bisa memanggil fungsi ini (dipaksakan lewat
 *     tipe: pemanggil wajib membawa userId, dan fungsi memverifikasi owner).
 */

import { createHash, randomUUID } from "node:crypto";
import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";

export type ApprovalAction =
  | "app.delete_chat"
  | "app.share_chat"
  | "connector.send"
  | "connector.read";

/** Umur approval; setelah itu tidak bisa dipakai. */
export const APPROVAL_TTL_MS = 10 * 60_000;

export type ApprovalRequest = {
  userId: string;
  runId: string | null;
  action: ApprovalAction;
  target: string;
  /** Ringkasan yang ditampilkan ke pengguna sebelum ia menekan setuju. */
  preview: Record<string, unknown>;
  payload: unknown;
  policyRevision: number;
};

export type Approval = {
  id: string;
  action: string;
  target: string;
  digest: string;
  status: string;
  expiresAt: Date;
};

/** Digest approval: aksi + target + payload + revisi kebijakan. */
export function approvalDigestFor(input: {
  userId: string;
  action: string;
  target: string;
  payload: unknown;
  runId: string | null;
  stepId: string | null;
  policyRevision: number;
}): string {
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(input.payload ?? null))
    .digest("hex");
  return createHash("sha256")
    .update(
      [
        input.userId,
        input.action,
        input.target,
        payloadHash,
        input.runId ?? "",
        input.stepId ?? "",
        String(input.policyRevision),
      ].join("\n"),
    )
    .digest("hex");
}

function notFound(): ApiError {
  return new ApiError({
    status: STATUS.NOT_FOUND,
    code: "NOT_FOUND",
    message: "Persetujuan tidak ditemukan.",
  });
}

/**
 * Buat permintaan approval. Pemilik task run diverifikasi; run milik orang lain
 * tidak bisa dimintai approval dari konteks pengguna ini.
 */
export async function requestApproval(db: Db, input: ApprovalRequest): Promise<Approval> {
  const digest = approvalDigestFor({
    userId: input.userId,
    action: input.action,
    target: input.target,
    payload: input.payload,
    runId: input.runId,
    stepId: null,
    policyRevision: input.policyRevision,
  });

  if (input.runId) {
    const run = await db.taskRun.findFirst({
      where: { id: input.runId, task: { userId: input.userId } },
      select: { id: true },
    });
    if (!run) throw notFound();
  }

  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);
  const id = `appr_${randomUUID()}`;
  const promptJson = JSON.stringify({
    action: input.action,
    target: input.target,
    digest,
    preview: input.preview,
    policyRevision: input.policyRevision,
  });

  // Approval di luar run (mis. dari chat) memakai TaskInteraction tanpa run?
  // Tidak: skema mewajibkan runId. Jalur chat memakai interaksi chat sendiri.
  if (!input.runId) {
    // Disimpan sebagai baris tanpa run tidak mungkin; kembalikan preview yang
    // bisa dipakai pemanggil untuk menampilkan dialog, dan pemanggil menyimpan
    // keputusannya sendiri. Digest tetap mengikat.
    return { id, action: input.action, target: input.target, digest, status: "proposed", expiresAt };
  }

  await db.taskInteraction.create({
    data: {
      id,
      runId: input.runId,
      kind: "approval",
      status: "pending",
      promptJson,
      expiresAt,
      answerJson: JSON.stringify({ payload: input.payload }),
    },
  });
  return { id, action: input.action, target: input.target, digest, status: "pending", expiresAt };
}

export type ApprovalDecision = {
  userId: string;
  approvalId: string;
  approve: boolean;
  /** Payload SESUAI yang disetujui; bila berbeda dari saat diminta → ditolak. */
  payload?: unknown;
  policyRevision: number;
};

/**
 * Jawab approval (setuju/tolak). Konsumsi atomik: satu UPDATE dengan WHERE
 * status=pending; jawaban kedua (atau berbarengan yang kalah) mendapat 409.
 */
export async function decideApproval(db: Db, input: ApprovalDecision): Promise<Approval> {
  const existing = await db.taskInteraction.findFirst({
    where: { id: input.approvalId, run: { task: { userId: input.userId } } },
    select: { id: true, status: true, promptJson: true, answerJson: true, expiresAt: true, runId: true },
  });
  if (!existing) throw notFound();
  if (existing.status !== "pending") {
    throw new ApiError({
      status: STATUS.CONFLICT,
      code: "APPROVAL_ALREADY_USED",
      message: "Persetujuan ini sudah dipakai atau kedaluwarsa.",
    });
  }
  if (existing.expiresAt.getTime() <= Date.now()) {
    await db.taskInteraction.updateMany({
      where: { id: existing.id, status: "pending" },
      data: { status: "expired" },
    });
    throw new ApiError({
      status: STATUS.CONFLICT,
      code: "APPROVAL_EXPIRED",
      message: "Persetujuan ini sudah kedaluwarsa.",
    });
  }

  const prompt = JSON.parse(existing.promptJson) as {
    action: string;
    target: string;
    digest: string;
    policyRevision: number;
  };

  // Perubahan argumen/payload/revisi membatalkan approval.
  const expected = approvalDigestFor({
    userId: input.userId,
    action: prompt.action,
    target: prompt.target,
    payload: input.payload ?? (existing.answerJson ? JSON.parse(existing.answerJson).payload : null),
    runId: existing.runId,
    stepId: null,
    policyRevision: input.policyRevision,
  });
  if (expected !== prompt.digest) {
    throw new ApiError({
      status: STATUS.CONFLICT,
      code: "APPROVAL_DIGEST_MISMATCH",
      message: "Aksi berubah sejak persetujuan diminta; minta persetujuan baru.",
    });
  }
  if (input.policyRevision !== prompt.policyRevision) {
    throw new ApiError({
      status: STATUS.CONFLICT,
      code: "APPROVAL_DIGEST_MISMATCH",
      message: "Kebijakan berubah sejak persetujuan diminta; minta persetujuan baru.",
    });
  }

  const status = input.approve ? "accepted" : "rejected";
  const updated = await db.taskInteraction.updateMany({
    where: { id: existing.id, status: "pending" },
    data: { status, answerJson: JSON.stringify({ approved: input.approve }), consumedAt: new Date() },
  });
  if (updated.count === 0) {
    throw new ApiError({
      status: STATUS.CONFLICT,
      code: "APPROVAL_ALREADY_USED",
      message: "Persetujuan ini sudah dipakai.",
    });
  }
  return {
    id: existing.id,
    action: prompt.action,
    target: prompt.target,
    digest: prompt.digest,
    status,
    expiresAt: existing.expiresAt,
  };
}
