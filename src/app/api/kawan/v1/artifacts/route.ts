/**
 * Artefak pengguna (FIX-11): `GET` daftar, `POST` buat dari konten bertipe.
 *
 * Konten diterima sebagai schema `{format, displayName, content|rows|doc|files}` —
 * tidak pernah path. PPTX hanya lewat tool; ZIP lewat daftar `files` tervalidasi.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { createArtifact, listArtifacts, openArtifactBytes } from "@/lib/artifacts/create";
import { isArtifactFormat } from "@/lib/artifacts/format";
import { convertArtifact, type ConvertedContent } from "@/lib/artifacts/convert";
import { ArtifactError } from "@/lib/artifacts/render";
import { parseDocSchema } from "@/lib/artifacts/document";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/artifacts";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    return jsonOk({ artifacts: await listArtifacts(db, userId) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function POST(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const body = await readJson(request);

    const format = body["format"];
    // FIX-12: konversi dari artefak yang sudah ada → versi baru, sumber utuh.
    if (typeof body["convertFrom"] === "string") {
      if (!isArtifactFormat(format)) {
        throw new ApiError({
          status: STATUS.BAD_REQUEST,
          code: "INVALID_FORMAT",
          message: "Format artefak tidak didukung.",
        });
      }
      const source = await openArtifactBytes(db, userId, body["convertFrom"]);
      const sourceFormat = source.artifact.format;
      const text = source.bytes.toString("utf8");
      let converted: ConvertedContent;
      try {
        converted = convertArtifact(
          sourceFormat === "json"
            ? { format: "json", content: JSON.parse(text) }
            : sourceFormat === "csv"
              ? { format: "csv", rows: text.split(/\r?\n/).map((line: string) => line.split(",")) }
              : { format: sourceFormat as "md" | "txt" | "html", content: text },
          format,
        );
      } catch (err) {
        // Konten sumber korup atau pasangan format tidak didukung → 400, bukan 500.
        if (err instanceof SyntaxError) throw new ArtifactError("SOURCE_UNREADABLE");
        throw err;
      }
      const artifact = await createArtifact(db, {
        userId,
        parentArtifactId: source.artifact.id,
        displayName:
          typeof body["displayName"] === "string"
            ? body["displayName"]
            : source.artifact.displayName,
        input:
          converted.format === "json"
            ? { format: "json", content: JSON.parse(converted.content) }
            : { format: converted.format as "md" | "txt" | "html", content: converted.content },
      });
      return jsonOk({ artifact }, reqId, 201);
    }

    // pptx internal (hanya lewat tool), zip punya jalur sendiri di bawah.
    if (format === "pptx") {
      throw new ApiError({
        status: STATUS.BAD_REQUEST,
        code: "FORMAT_NOT_READY",
        message: "Format ini belum tersedia.",
      });
    }
    if (!isArtifactFormat(format)) {
      throw new ApiError({
        status: STATUS.BAD_REQUEST,
        code: "INVALID_FORMAT",
        message: "Format artefak tidak didukung.",
      });
    }
    if (format === "zip") {
      // FIX-12: ZIP dibuat dari daftar berkas teks; nama divalidasi di writeZip.
      const files = body["files"];
      if (!Array.isArray(files) || files.length === 0) {
        throw new ApiError({
          status: STATUS.BAD_REQUEST,
          code: "INVALID_CONTENT",
          message: "ZIP membutuhkan daftar `files`.",
        });
      }
      const entries = files.map((entry) => {
        const item = entry as Record<string, unknown>;
        if (typeof item?.["name"] !== "string" || typeof item?.["content"] !== "string") {
          throw new ApiError({
            status: STATUS.BAD_REQUEST,
            code: "INVALID_CONTENT",
            message: "Setiap berkas butuh `name` dan `content`.",
          });
        }
        return { name: item["name"], content: item["content"] };
      });
      const artifact = await createArtifact(db, {
        userId,
        chatId: typeof body["chatId"] === "string" ? body["chatId"] : null,
        messageId: typeof body["messageId"] === "string" ? body["messageId"] : null,
        parentArtifactId: typeof body["parentArtifactId"] === "string" ? body["parentArtifactId"] : null,
        displayName: typeof body["displayName"] === "string" ? body["displayName"] : "",
        input: { format: "zip", files: entries },
      });
      if (artifact.status === "failed") {
        throw new ApiError({
          status: STATUS.INTERNAL,
          code: "ARTIFACT_WRITE_FAILED",
          message: "Berkas gagal disimpan.",
        });
      }
      return jsonOk({ artifact }, reqId, 201);
    }

    const displayName = typeof body["displayName"] === "string" ? body["displayName"] : "";
    // Diisi hanya oleh cabang dokumen terstruktur di bawah.
    let docTruncated = false;
    let docUnknownBlocks = 0;

    let input: Parameters<typeof createArtifact>[1]["input"] | null;
    if (format === "png") {
      // FIX-16: PNG hanya lahir dari pembuatan gambar di server, tidak dari
      // klien — byte base64 dari klien tidak diterima di sini.
      throw new ApiError({
        status: STATUS.BAD_REQUEST,
        code: "FORMAT_NOT_READY",
        message: "Format PNG dibuat lewat endpoint media, bukan dari klien.",
      });
    }
    if (format === "pdf" || format === "docx" || format === "xlsx") {
      // Dokumen terstruktur: `doc` wajib, konten teks tidak diterima.
      if ("content" in body || "rows" in body) {
        throw new ApiError({
          status: STATUS.BAD_REQUEST,
          code: "INVALID_DOC_SCHEMA",
          message: "Format dokumen hanya menerima `doc`.",
        });
      }
      try {
        // W2-7: potongan tidak boleh hilang diam-diam di jalur API. Jalur chat
        // menerbitkan note `doc-truncated`; di sini flag-nya dikembalikan di
        // badan respons 201 supaya klien bisa memberi tahu hal yang sama.
        const parsed = parseDocSchema(body["doc"]);
        docTruncated = parsed.truncated;
        docUnknownBlocks = parsed.unknownBlocks;
        input = { format, doc: parsed };
      } catch (err) {
        if (err instanceof ArtifactError && err.code === "INVALID_DOC_SCHEMA") {
          throw new ApiError({
            status: STATUS.BAD_REQUEST,
            code: "INVALID_DOC_SCHEMA",
            message: err.message,
          });
        }
        throw err;
      }
    } else {
      input =
        format === "csv"
          ? Array.isArray(body["rows"])
            ? { format, rows: body["rows"] as unknown[][] }
            : null
          : format === "json"
            ? { format, content: body["content"] }
            : typeof body["content"] === "string"
              ? { format, content: body["content"] }
              : null;
    }

    if (!input) {
      throw new ApiError({
        status: STATUS.BAD_REQUEST,
        code: "INVALID_CONTENT",
        message: "Konten artefak tidak sesuai format.",
      });
    }

    const artifact = await createArtifact(db, {
      userId,
      chatId: typeof body["chatId"] === "string" ? body["chatId"] : null,
      messageId: typeof body["messageId"] === "string" ? body["messageId"] : null,
      parentArtifactId: typeof body["parentArtifactId"] === "string" ? body["parentArtifactId"] : null,
      displayName,
      input,
    });

    if (artifact.status === "failed") {
      throw new ApiError({
        status: STATUS.INTERNAL,
        code: "ARTIFACT_WRITE_FAILED",
        message: "Berkas gagal disimpan.",
      });
    }

    return jsonOk(
      {
        artifact,
        // W2-7: flag pemotongan terlihat di jalur API, bukan sekadar di jalur chat.
        ...(docTruncated || docUnknownBlocks > 0
          ? { docTruncated, docUnknownBlocks }
          : {}),
      },
      reqId,
      201,
    );
  } catch (err) {
    if (err instanceof ArtifactError) {
      return handleRouteError(
        new ApiError({
          status: err.code === "TOO_LARGE" ? STATUS.PAYLOAD_TOO_LARGE : STATUS.BAD_REQUEST,
          code: err.code,
          message: err.message,
        }),
        reqId,
        ROUTE,
        started,
      );
    }
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
