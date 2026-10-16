/**
 * Uji pemetaan galat provider (SDD-5.4, SDD-3.2).
 *
 * Bukti inti: setiap keadaan SDD-5.4 punya pesan bahasa Indonesia verbatim,
 * dan 401/403 gateway TIDAK pernah menjadi 401/403 ke klien Kawan (SDD-5.4:
 * "401 gateway bukan 401 akun").
 */

import { describe, expect, it } from "vitest";
import { ApiError, STATUS } from "@/lib/api/errors";
import {
  DISCONNECTED_MESSAGE,
  PROVIDER_MESSAGES,
  RATE_LIMITED_MESSAGE,
  fromApiError,
  fromUpstreamStatus,
  toApiError,
} from "./errors";

describe("fromUpstreamStatus — pesan verbatim SDD-5.4", () => {
  it("401 → UNAUTHORIZED + \"Key ditolak oleh gateway.\"", () => {
    const failure = fromUpstreamStatus(401);
    expect(failure.reason).toBe("UNAUTHORIZED");
    expect(failure.message).toBe("Key ditolak oleh gateway.");
  });

  it("403 → FORBIDDEN + \"Gateway menolak permintaan ini.\"", () => {
    const failure = fromUpstreamStatus(403);
    expect(failure.reason).toBe("FORBIDDEN");
    expect(failure.message).toBe("Gateway menolak permintaan ini.");
  });

  it("429 → pesan \"Terlalu banyak permintaan. Coba lagi sebentar.\"", () => {
    const failure = fromUpstreamStatus(429);
    expect(failure.reason).toBe("UPSTREAM_ERROR");
    expect(failure.message).toBe(RATE_LIMITED_MESSAGE);
    expect(failure.retryable).toBe(true);
  });

  it("5xx → UPSTREAM_ERROR + \"Gateway sedang bermasalah.\"", () => {
    for (const status of [500, 502, 503]) {
      const failure = fromUpstreamStatus(status);
      expect(failure.reason).toBe("UPSTREAM_ERROR");
      expect(failure.message).toBe("Gateway sedang bermasalah.");
      expect(failure.retryable).toBe(true);
    }
  });

  it("404 → NOT_FOUND dengan pesan yang dapat ditindaklanjuti", () => {
    const failure = fromUpstreamStatus(404);
    expect(failure.reason).toBe("NOT_FOUND");
    expect(failure.message).toBe(PROVIDER_MESSAGES.NOT_FOUND);
  });
});

describe("fromApiError — terjemahan galat fetchJson", () => {
  it("timeout → TIMEOUT + \"Gateway tidak merespons.\"", () => {
    const failure = fromApiError(
      new ApiError({
        status: STATUS.GATEWAY_TIMEOUT,
        code: "UPSTREAM_TIMEOUT",
        message: "apa saja",
      }),
    );
    expect(failure.reason).toBe("TIMEOUT");
    expect(failure.message).toBe("Gateway tidak merespons.");
  });

  it("koneksi putus → pesan \"Koneksi terputus.\"", () => {
    const failure = fromApiError(
      new ApiError({
        status: STATUS.SERVICE_UNAVAILABLE,
        code: "UPSTREAM_UNAVAILABLE",
        message: "apa saja",
      }),
    );
    expect(failure.message).toBe(DISCONNECTED_MESSAGE);
    expect(failure.reason).toBe("UPSTREAM_ERROR");
  });

  it("balasan tidak terbaca → UPSTREAM_ERROR (bukan lempar)", () => {
    const failure = fromApiError(
      new ApiError({
        status: STATUS.BAD_GATEWAY,
        code: "UPSTREAM_BAD_RESPONSE",
        message: "apa saja",
      }),
    );
    expect(failure.reason).toBe("UPSTREAM_ERROR");
    expect(failure.retryable).toBe(false);
  });

  it("BAD_URL memakai pesan spesifik dari kebijakan keluar", () => {
    const failure = fromApiError(
      new ApiError({
        status: STATUS.UNPROCESSABLE,
        code: "BAD_URL",
        message: "Alamat http:// tanpa TLS tidak diizinkan.",
      }),
    );
    expect(failure.reason).toBe("BAD_URL");
    expect(failure.message).toBe("Alamat http:// tanpa TLS tidak diizinkan.");
  });
});

describe("toApiError — status HTTP ke klien Kawan", () => {
  it("KRITIS: 401 dan 403 gateway menjadi 502, bukan 401/403 akun (SDD-5.4)", () => {
    const unauthorized = toApiError(fromUpstreamStatus(401));
    expect(unauthorized.status).toBe(STATUS.BAD_GATEWAY);
    expect(unauthorized.status).not.toBe(STATUS.UNAUTHORIZED);
    expect(unauthorized.code).toBe("UNAUTHORIZED");

    const forbidden = toApiError(fromUpstreamStatus(403));
    expect(forbidden.status).toBe(STATUS.BAD_GATEWAY);
    expect(forbidden.status).not.toBe(STATUS.FORBIDDEN);
  });

  it("timeout menjadi 504 dan koneksi putus menjadi 503", () => {
    expect(
      toApiError({ reason: "TIMEOUT", message: PROVIDER_MESSAGES.TIMEOUT, retryable: true }).status,
    ).toBe(STATUS.GATEWAY_TIMEOUT);
    expect(
      toApiError({ reason: "DNS", message: PROVIDER_MESSAGES.DNS, retryable: true }).status,
    ).toBe(STATUS.SERVICE_UNAVAILABLE);
    expect(
      toApiError({ reason: "TLS", message: PROVIDER_MESSAGES.TLS, retryable: true }).status,
    ).toBe(STATUS.SERVICE_UNAVAILABLE);
  });

  it("EMPTY_MODELS menjadi 502 dan BAD_URL menjadi 422", () => {
    expect(
      toApiError({ reason: "EMPTY_MODELS", message: PROVIDER_MESSAGES.EMPTY_MODELS, retryable: false })
        .status,
    ).toBe(STATUS.BAD_GATEWAY);
    expect(
      toApiError({ reason: "BAD_URL", message: "x", retryable: false }).status,
    ).toBe(STATUS.UNPROCESSABLE);
  });
});
