/**
 * Delegasi antar-agen (Langkah 3): tool `call_agent`.
 *
 * Satu arah saja: agen pemilik chat (lead) memanggil sub-agen yang terdaftar di
 * `allowed_sub_agents` berkasnya. Sub-agen TIDAK boleh memanggil siapa pun —
 * batas kedalaman 2 ditegakkan dengan konstruksi, bukan dengan penghitung yang
 * bisa lupa dinaikkan: `delegate()` hanya menerima lead + target, dan prompt
 * sub-agen dirakit tanpa tool `call_agent` sama sekali.
 *
 * Sub-agen TIDAK punya tool jaringan/berkas. Ia menjawab dari konteks yang
 * diberikan lead; itu membuat delegasi murah dan hasilnya bisa diaudit.
 */

import { randomUUID } from "node:crypto";
import { fetchOutbound, type OutboundPolicyOptions } from "@/lib/net";
import { getAgentFile, type AgentFile } from "./loader";

export const CALL_AGENT_TOOL_NAME = "call_agent";

/** Batas hasil sub-agen yang dikembalikan ke lead; sisanya dipotong. */
export const DELEGATION_MAX_CHARS = 6_000;

/** Nama tool yang dikirim ke gateway. Enum target dibatasi ke sub-agen sah. */
export function callAgentTool(allowed: readonly string[]) {
  return {
    type: "function" as const,
    function: {
      name: CALL_AGENT_TOOL_NAME,
      description:
        "Delegasikan satu tugas fokus ke sub-agen dan kembalikan hasilnya. Pakai bila tugas butuh keahlian agen lain; hasilnya bahan, bukan jawaban akhir.",
      parameters: {
        type: "object",
        properties: {
          target_agent_id: { type: "string", enum: [...allowed] },
          task_payload: {
            type: "string",
            minLength: 1,
            maxLength: 4_000,
            description: "Instruksi tunggal dan mandiri untuk sub-agen.",
          },
          context: {
            type: "string",
            maxLength: 8_000,
            description: "Konteks pendukung: potongan kode, batasan, temuan sebelumnya.",
          },
        },
        required: ["target_agent_id", "task_payload"],
        additionalProperties: false,
      },
    },
  };
}

export type DelegateResult = {
  status: "ok" | "invalid" | "failed";
  text?: string;
  message?: string;
  errorCode?: string;
};

/** Argumen divalidasi di sini, bukan di handler: tool asing = tolak, bukan tebak. */
export function parseCallAgentArgs(parsed: unknown): {
  targetAgentId: string;
  taskPayload: string;
  context: string;
} {
  // `assembleToolCalls` sudah mem-parse JSON; objek mentah dari pemanggil lain
  // tetap ditolak dengan pesan yang sama alih-alih TypeError acak.
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Argumen call_agent harus objek.");
  }
  const data = parsed as Record<string, unknown>;
  const targetAgentId = data["target_agent_id"];
  const taskPayload = data["task_payload"];
  const context = data["context"];
  if (typeof targetAgentId !== "string" || targetAgentId.trim() === "") {
    throw new Error("target_agent_id wajib berupa teks.");
  }
  if (typeof taskPayload !== "string" || taskPayload.trim() === "") {
    throw new Error("task_payload wajib berupa teks.");
  }
  if (context !== undefined && context !== null && typeof context !== "string") {
    throw new Error("context harus berupa teks.");
  }
  return {
    targetAgentId: targetAgentId.trim(),
    taskPayload: taskPayload.trim(),
    context: typeof context === "string" ? context.trim() : "",
  };
}

export type DelegateInput = {
  lead: AgentFile;
  args: { targetAgentId: string; taskPayload: string; context: string };
  /** Kredensial koneksi aktif yang sudah dibuka generate.ts. */
  url: URL;
  apiKey: string;
  modelId: string;
  outbound: OutboundPolicyOptions;
  signal: AbortSignal;
};

/**
 * Jalankan sub-agen sekali jalan (tanpa stream, tanpa tool) dan kembalikan
 * teksnya. Galat provider menjadi hasil `failed`, bukan lemparan: delegasi yang
 * gagal tidak boleh menggagalkan jawaban lead.
 */
export async function delegateAgent(input: DelegateInput): Promise<DelegateResult> {
  const allowed = input.lead.allowedSubAgents;
  if (!allowed.includes(input.args.targetAgentId)) {
    return {
      status: "invalid",
      message: `Agen "${input.args.targetAgentId}" bukan sub-agen yang boleh dipanggil "${input.lead.id}".`,
      errorCode: "SUBAGENT_NOT_ALLOWED",
    };
  }
  // Nama berkas mengikuti id agen; loader menolak id asing, jadi target di luar
  // daftar tidak bisa lolos lewat nama berkas buatan.
  const target = getAgentFile(input.args.targetAgentId);
  if (!target || target.id !== input.args.targetAgentId) {
    return {
      status: "invalid",
      message: `Agen "${input.args.targetAgentId}" tidak ditemukan.`,
      errorCode: "SUBAGENT_NOT_FOUND",
    };
  }

  const userContent = input.args.context
    ? `${input.args.taskPayload}\n\n---\nKonteks dari agen pemanggil:\n${input.args.context}`
    : input.args.taskPayload;

  try {
    const response = await fetchOutbound(
      input.url,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(input.apiKey === "" ? {} : { authorization: `Bearer ${input.apiKey}` }),
        },
        body: JSON.stringify({
          model: input.modelId,
          stream: false,
          messages: [
            { role: "system", content: target.body },
            { role: "user", content: userContent },
          ],
        }),
        signal: input.signal,
      },
      input.outbound,
      0,
    );

    if (!response.ok) {
      return {
        status: "failed",
        message: `Sub-agen membalas ${response.status}.`,
        errorCode: response.status === 429 ? "RATE_LIMITED" : "UPSTREAM_ERROR",
      };
    }
    const payload = (await response.json().catch(() => null)) as
      | { choices?: { message?: { content?: unknown } }[] }
      | null;
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      return { status: "failed", message: "Sub-agen tidak mengembalikan teks.", errorCode: "EMPTY" };
    }
    const text = content.trim();
    const truncated = text.length > DELEGATION_MAX_CHARS;
    return {
      status: "ok",
      text: truncated ? `${text.slice(0, DELEGATION_MAX_CHARS)}\n…(dipotong)` : text,
      ...(truncated ? { errorCode: "TRUNCATED" } : {}),
    };
  } catch (err) {
    if (input.signal.aborted) throw err;
    return {
      status: "failed",
      message: err instanceof Error ? err.message : "Delegasi gagal.",
      errorCode: "DELEGATE_FAILED",
    };
  }
}

/** Bagian `content` untuk pesan role=tool; selalu teks, tak pernah kosong. */
export function delegateToolText(result: DelegateResult, targetAgentId: string): string {
  if (result.status === "ok") return `Hasil dari sub-agen ${targetAgentId}:\n${result.text ?? ""}`;
  return `Sub-agen ${targetAgentId} gagal (${result.errorCode ?? "UNKNOWN"}): ${result.message ?? ""}`;
}

/** Id tool call dari model bisa kosong; provider tetap butuh id untuk dipasangkan. */
export function toolCallId(id?: string): string {
  return id && id.trim() !== "" ? id : `call_${randomUUID()}`;
}
