import "server-only";

import { apiFetch, ApiError } from "./client";
import type {
  Entertainer,
  PlatformSettings,
  QrCode,
  SplitRule,
  SplitRuleAuditEvent,
  SplitRuleProposal,
  Venue,
} from "./types";

/**
 * Authenticated dashboard resources. Every function here maps to an endpoint
 * confirmed live in docs/api-audit.md §3.5.
 *
 * NOT PRESENT, deliberately: there are no transaction-list, payout, or
 * aggregate-totals functions, because no such endpoints exist. The dashboard
 * renders those surfaces as "not yet available" rather than computing
 * plausible-looking numbers from partial data.
 */

export const listVenues = (token: string) => apiFetch<Venue[]>("/venues", { token });

export const getVenue = (token: string, venueId: string) =>
  apiFetch<Venue>(`/venues/${venueId}`, { token });

export const updateVenue = (token: string, venueId: string, body: Partial<Venue>) =>
  apiFetch<Venue>(`/venues/${venueId}`, { method: "PATCH", token, body });

/** Platform-admin only; the backend rejects a VENUE_ADMIN with 403. */
export const createVenue = (
  token: string,
  body: { name: string; slug: string; location: string; logoUrl?: string },
) => apiFetch<Venue>("/venues", { method: "POST", token, body });

/** Soft delete. */
export const deactivateVenue = (token: string, venueId: string) =>
  apiFetch<void>(`/venues/${venueId}`, { method: "DELETE", token });

export const listEntertainers = (token: string) =>
  apiFetch<Entertainer[]>("/entertainers", { token });

export const createEntertainer = (
  token: string,
  body: {
    stageName: string;
    legalName: string;
    phone: string;
    bankName?: string;
    accountNumber?: string;
  },
) => apiFetch<Entertainer>("/entertainers", { method: "POST", token, body });

export const updateEntertainer = (
  token: string,
  entertainerId: string,
  body: Record<string, unknown>,
) => apiFetch<Entertainer>(`/entertainers/${entertainerId}`, {
  method: "PATCH",
  token,
  body,
});

export const deactivateEntertainer = (token: string, entertainerId: string) =>
  apiFetch<void>(`/entertainers/${entertainerId}`, { method: "DELETE", token });

export const linkEntertainerToVenue = (
  token: string,
  entertainerId: string,
  venueId: string,
) => apiFetch<Entertainer>(`/entertainers/${entertainerId}/venues/${venueId}`, {
  method: "POST",
  token,
});

export const unlinkEntertainerFromVenue = (
  token: string,
  entertainerId: string,
  venueId: string,
) => apiFetch<void>(`/entertainers/${entertainerId}/venues/${venueId}`, {
  method: "DELETE",
  token,
});

export const listQrCodes = (token: string) => apiFetch<QrCode[]>("/qr-codes", { token });

export const createQrCode = (
  token: string,
  body: { venueId: string; entertainerId?: string; location: string },
) => apiFetch<QrCode>("/qr-codes", { method: "POST", token, body });

export const deactivateQrCode = (token: string, qrCodeId: string) =>
  apiFetch<void>(`/qr-codes/${qrCodeId}`, { method: "DELETE", token });

export const regenerateQrCode = (token: string, qrCodeId: string) =>
  apiFetch<QrCode>(`/qr-codes/${qrCodeId}/regenerate`, { method: "POST", token });

export const listSplitRules = (token: string, venueId: string) =>
  apiFetch<SplitRule[]>(`/split-rules/venue/${venueId}`, { token });

export const getActiveSplitRule = (token: string, venueId: string) =>
  apiFetch<SplitRule>(`/split-rules/venue/${venueId}/active`, { token });

export const getSplitRuleAudit = (token: string, splitRuleId: string) =>
  apiFetch<SplitRuleAuditEvent[]>(`/split-rules/${splitRuleId}/audit`, { token });

/**
 * Reads the platform fee, and doubles as this app's capability probe.
 *
 * `null` means the endpoint is not there — the deployed backend predates split-rule
 * governance. Every governance surface keys off this one call rather than each
 * guessing separately, so the dashboard degrades in one place instead of erroring
 * in six. Verified live on 2026-09-26: the deployed API returns 404 here.
 */
export async function getPlatformSettings(
  token: string,
): Promise<PlatformSettings | null> {
  try {
    return await apiFetch<PlatformSettings>("/platform/settings", { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** PLATFORM_ADMIN only. Rules already in force keep the fee they were agreed under. */
export const updatePlatformSettings = (token: string, platformFeeBps: number) =>
  apiFetch<PlatformSettings>("/platform/settings", {
    method: "PATCH",
    token,
    body: { platformFeeBps },
  });

/**
 * Governance API: proposes a split and returns a one-time consent link.
 *
 * The rule is created PENDING_ENTERTAINER_APPROVAL and divides no money until the
 * entertainer accepts. `platformBps` is deliberately absent — sending it is a 400,
 * because the platform's cut is server-side only.
 */
export const proposeSplitRule = (
  token: string,
  body: {
    venueId: string;
    entertainerId: string;
    entertainerBps: number;
    venueBps: number;
  },
) => apiFetch<SplitRuleProposal>("/split-rules", { method: "POST", token, body });

/** PLATFORM_ADMIN only. Bypasses consent, stamped ADMIN_OVERRIDE in the audit trail. */
export const overrideSplitRule = (
  token: string,
  body: {
    venueId: string;
    entertainerBps: number;
    venueBps: number;
    platformBps: number;
    reason: string;
  },
) => apiFetch<SplitRule>("/split-rules/override", { method: "POST", token, body });

/**
 * LEGACY split-rule creation, for a backend without governance. All three shares
 * come from the client and the rule takes effect immediately. Used only when
 * getPlatformSettings() returned null.
 */
export const createSplitRuleLegacy = (
  token: string,
  body: {
    venueId: string;
    entertainerBps: number;
    venueBps: number;
    platformBps: number;
  },
) => apiFetch<SplitRule>("/split-rules", { method: "POST", token, body });
