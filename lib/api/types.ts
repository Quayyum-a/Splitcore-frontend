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

/* ---------------------------------------------------------------- splits */

/**
 * A split isn't real until the entertainer has agreed to it. These states are
 * the backend's Prisma enum; none may be collapsed into another in the UI.
 */
export const SPLIT_RULE_STATUSES = [
  "PENDING_ENTERTAINER_APPROVAL",
  "ACTIVE",
  "REJECTED",
  "SUPERSEDED",
] as const;
export type SplitRuleStatus = (typeof SPLIT_RULE_STATUSES)[number];

/** VENUE_PROPOSAL = the entertainer accepted. ADMIN_OVERRIDE = nobody did. */
export const SPLIT_RULE_ORIGINS = ["VENUE_PROPOSAL", "ADMIN_OVERRIDE"] as const;
export type SplitRuleOrigin = (typeof SPLIT_RULE_ORIGINS)[number];

/** Shares are basis points: 10000 = 100%. History is append-only. */
export interface SplitRule {
  id: string;
  venueId: string;
  entertainerBps: number;
  venueBps: number;
  /** Always computed server-side on the governance API; never client input. */
  platformBps: number;
  /** Null while a proposal is unanswered — an unenforced rule has no start date. */
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;

  /* Present only on the governance API. A legacy backend omits them entirely,
     which is what `isGovernanceRule` below detects. */
  status?: SplitRuleStatus;
  origin?: SplitRuleOrigin;
  entertainerId?: string | null;
  proposedByUserId?: string | null;
  proposedAt?: string;
  respondedAt?: string | null;
}

/**
 * The legacy API returns rules with no `status`. Treat those as active when
 * they have no `effectiveTo`, which is exactly what "active" meant before.
 */
export function effectiveStatus(rule: SplitRule): SplitRuleStatus {
  if (rule.status) return rule.status;
  return rule.effectiveTo ? "SUPERSEDED" : "ACTIVE";
}

/** POST /split-rules on the governance API — carries the one-time consent link. */
export interface SplitRuleProposal extends SplitRule {
  consentUrl: string;
  consentToken: string;
}

/** GET /platform/settings — absent on a legacy backend. */
export interface PlatformSettings {
  platformFeeBps: number;
  /** What venue and entertainer divide between them. A proposal must sum to this. */
  splittableBps: number;
  updatedAt: string;
}

/** GET /split-rules/{id}/respond/{token} — public, no login. */
export interface SplitRuleTerms {
  venueName: string;
  entertainerName: string;
  entertainerPercentage: number;
  venuePercentage: number;
  platformPercentage: number;
  entertainerBps: number;
  venueBps: number;
  platformBps: number;
  proposedAt: string;
  /** A worked example in plain words, written by the backend. */
  example: string;
}

export interface SplitRuleAuditEvent {
  id?: string;
  splitRuleId?: string;
  event?: string;
  actorUserId?: string | null;
  createdAt?: string;
  [key: string]: unknown;
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
