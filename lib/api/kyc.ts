import "server-only";

import { apiFetch } from "./client";
import type { IssuedLoginLink, KycStatusResponse } from "./types";

/**
 * Entertainer onboarding (Phase 6).
 *
 * Every endpoint here answers with the same `KycStatusResponse`, including a
 * server-derived `nextStep`. The UI therefore never works out where someone is
 * in the flow — it renders whatever the backend says the next step is. That
 * keeps one source of truth for a sequence with real money at the end of it.
 */

export const getKycStatus = (token: string, entertainerId: string) =>
  apiFetch<KycStatusResponse>(`/entertainers/${entertainerId}/kyc/status`, { token });

/** Step 1. Changing the account clears any previous resolution and confirmation. */
export const submitBankDetails = (
  token: string,
  entertainerId: string,
  body: { bankName: string; bankCode: string; accountNumber: string },
) =>
  apiFetch<KycStatusResponse>(`/entertainers/${entertainerId}/kyc/bank-details`, {
    method: "POST",
    token,
    body,
  });

/** Step 2. Asks the bank who owns the account. A rejection sets KYC to FAILED. */
export const resolveAccount = (token: string, entertainerId: string) =>
  apiFetch<KycStatusResponse>(`/entertainers/${entertainerId}/kyc/resolve-account`, {
    method: "POST",
    token,
  });

/**
 * Step 3. The name must match what the bank returned, compared case- and
 * spacing-insensitively — this is the step that makes a payout destination
 * trusted rather than merely typed.
 */
export const confirmAccount = (
  token: string,
  entertainerId: string,
  confirmedAccountName: string,
) =>
  apiFetch<KycStatusResponse>(`/entertainers/${entertainerId}/kyc/confirm-account`, {
    method: "POST",
    token,
    body: { confirmedAccountName },
  });

/**
 * Step 4. The document number is forwarded to the provider and never stored,
 * logged or returned — so it must never be put anywhere but this request.
 */
export const verifyIdentity = (
  token: string,
  entertainerId: string,
  body: { documentType: "BVN" | "NIN"; documentNumber: string },
) =>
  apiFetch<KycStatusResponse>(`/entertainers/${entertainerId}/kyc/verify-identity`, {
    method: "POST",
    token,
    body,
  });

/** PLATFORM_ADMIN only. The exit from REVIEW. */
export const decideKycReview = (
  token: string,
  entertainerId: string,
  body: { decision: "APPROVE" | "REJECT"; reason: string },
) =>
  apiFetch<KycStatusResponse>(`/entertainers/${entertainerId}/kyc/review`, {
    method: "POST",
    token,
    body,
  });

/**
 * Issues a one-time login link for an entertainer. Expires in 30 minutes,
 * single use, and issuing a new one invalidates any outstanding link. There is
 * no notification channel, so the venue dashboard delivers it by hand.
 */
export const issueLoginLink = (token: string, entertainerId: string) =>
  apiFetch<IssuedLoginLink>(`/entertainer-auth/login-links/${entertainerId}`, {
    method: "POST",
    token,
  });
