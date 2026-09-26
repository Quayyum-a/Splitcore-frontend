/**
 * Types mirroring the live backend's OpenAPI document.
 * Source of truth: docs/api-audit.md (audited 2026-09-25).
 * Do not add fields here that the audit didn't confirm.
 */

export interface VenueBasic {
  id: string;
  name: string;
  logoUrl: string | null;
  location: string;
}

export interface EntertainerBasic {
  id: string;
  stageName: string;
}

/** GET /t/{publicToken} — resolving a token also creates a guest session. */
export interface QrResolution {
  venue: VenueBasic;
  entertainer: EntertainerBasic | null;
  location: string;
  sessionId: string;
  expiresAt: string;
}

/** POST /payments/initialize */
export interface InitializePaymentRequest {
  sessionId: string;
  amountKobo: number;
  guestDisplayName?: string;
  displayNameEnabled?: boolean;
  email?: string;
}

export interface PaymentInitResponse {
  transactionId: string;
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  amountKobo: number;
  status: string;
}

/** The complete set the backend can return. None may be collapsed into another. */
export const PAYMENT_STATUSES = [
  "CREATED",
  "PENDING",
  "SUCCESS",
  "FAILED",
  "ABANDONED",
  "REVERSED",
  "REFUNDED",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** GET /payments/{reference}/status */
export interface PaymentStatusResponse {
  transactionId: string;
  reference: string;
  status: PaymentStatus;
  amountKobo: number;
  venueName: string;
  entertainerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Venue {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  location: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const KYC_STATUSES = [
  "NOT_STARTED",
  "PENDING",
  "VERIFIED",
  "FAILED",
  "REVIEW",
  "SUSPENDED",
] as const;

export type KycStatus = (typeof KYC_STATUSES)[number];

export interface Entertainer {
  id: string;
  stageName: string;
  legalName: string;
  phone: string;
  bankName: string | null;
  accountNumber: string | null;
  kycStatus: KycStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  venueIds: string[];
}

export interface QrCode {
  id: string;
  publicToken: string;
  venueId: string;
  entertainerId: string | null;
  location: string;
  isActive: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  venue?: Venue;
  entertainer?: Entertainer;
}

/** Shares are basis points: 10000 = 100%. Rules are append-only history. */
export interface SplitRule {
  id: string;
  venueId: string;
  entertainerBps: number;
  venueBps: number;
  platformBps: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Backend Prisma `Role` enum. Confirmed values, not a guess. */
export const ROLES = ["PLATFORM_ADMIN", "VENUE_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export interface SessionUser {
  id?: string;
  email?: string;
  role?: Role;
}
