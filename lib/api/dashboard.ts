import "server-only";

import { apiFetch } from "./client";
import type { Entertainer, QrCode, SplitRule, Venue } from "./types";

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

export const createSplitRule = (
  token: string,
  body: {
    venueId: string;
    entertainerBps: number;
    venueBps: number;
    platformBps: number;
  },
) => apiFetch<SplitRule>("/split-rules", { method: "POST", token, body });
