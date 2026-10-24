/**
 * Bentuk galat seragam (SDD-3.1) dan id permintaan (`X-Request-Id`).
 *
 * Setiap route `/api/kawan/v1/*` melempar `ApiError` dan mengubahnya dengan
 * `toErrorResponse`. Pesan galat yang tidak dikenal tidak pernah diteruskan
 * ke pemanggil: teks internal bocor lewat pesan, jadi diganti pesan generik.
 */

import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "X-Request-Id";

export const STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type ErrorStatus = (typeof STATUS)[keyof typeof STATUS];

export type ApiErrorInit = {
  status: ErrorStatus;
  code: string;
  message: string;
  /** Diisi eksplisit oleh galat transport yang memang layak diulang.
   *  Status saja tidak menentukan: 502 bisa tetap gagal bila penyebabnya
   *  bug, jadi tidak ada default dari status. */
  retryable?: boolean;
  /** Hanya field yang aman untuk peran pemanggil. */
  details?: Record<string, unknown>;
};

export class ApiError extends Error {
  readonly status: ErrorStatus;
  readonly code: string;
  readonly retryable: boolean;
  readonly details: Record<string, unknown> | undefined;

  constructor({ status, code, message, retryable, details }: ApiErrorInit) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable ?? false;
    this.details = details;
  }
}

export type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    requestId: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
};

export function errorEnvelope(err: ApiError, requestId: string): ErrorEnvelope {
  const { code, message, retryable, details } = err;
  return { error: { code, message, requestId, retryable, ...(details ? { details } : {}) } };
}

/** Bentuk id yang diterima dari klien. Header apa adanya dipakai sebagai
 *  id log, jadi string sembarang dari luar tidak boleh lolos: baris baru
 *  di header akan memecah satu baris log JSON jadi dua. */
const REQUEST_ID_RE = /^req_[A-Za-z0-9_-]{1,64}$/;

export function requestId(request?: Request): string {
  const incoming = request?.headers.get(REQUEST_ID_HEADER);
  if (incoming && REQUEST_ID_RE.test(incoming)) return incoming;
  return `req_${randomUUID().replace(/-/g, "")}`;
}

export function toErrorResponse(err: unknown, requestId_: string): Response {
  const apiError =
    err instanceof ApiError
      ? err
      : new ApiError({
          status: STATUS.INTERNAL,
          code: "INTERNAL_ERROR",
          message: "Terjadi galat internal.",
        });

  return Response.json(errorEnvelope(apiError, requestId_), {
    status: apiError.status,
    headers: { [REQUEST_ID_HEADER]: requestId_ },
  });
}
