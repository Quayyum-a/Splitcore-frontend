import "server-only";

import { apiFetch, ApiError } from "./client";
import type {
  InitializePaymentRequest,
  PaymentInitResponse,
  PaymentStatusResponse,
  QrResolution,
} from "./types";

/**
 * The guest hot path. Confirmed endpoints only — docs/api-audit.md §3.2–3.4.
 */

export type TokenResolution =
  | { kind: "ok"; data: QrResolution }
  | { kind: "not-found" } //  404 — token does not exist
  | { kind: "gone" } //       410 — QR / venue / entertainer deactivated
  | { kind: "error"; message: string };

/**
 * Resolve a scanned QR token. Deliberately returns a discriminated union rather
 * than throwing, because 404 and 410 are *expected product states* with their
 * own copy — not failures. Collapsing them into one generic error is exactly
 * what the spec forbids.
 *
 * Short timeout: a guest is standing in a club waiting for this screen.
 */
export async function resolveToken(publicToken: string): Promise<TokenResolution> {
  try {
    const data = await apiFetch<QrResolution>(`/t/${encodeURIComponent(publicToken)}`, {
      timeoutMs: 20_000,
    });
    return { kind: "ok", data };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) return { kind: "not-found" };
      if (error.status === 410) return { kind: "gone" };
      return { kind: "error", message: error.message };
    }
    throw error;
  }
}

export async function initializePayment(
  payload: InitializePaymentRequest,
): Promise<PaymentInitResponse> {
  return apiFetch<PaymentInitResponse>("/payments/initialize", {
    method: "POST",
    body: payload,
    timeoutMs: 25_000,
  });
}

export async function getPaymentStatus(reference: string): Promise<PaymentStatusResponse> {
  return apiFetch<PaymentStatusResponse>(
    `/payments/${encodeURIComponent(reference)}/status`,
    { timeoutMs: 20_000 },
  );
}
