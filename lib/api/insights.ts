import "server-only";

import { apiFetch, ApiError } from "./client";
import type {
  EntertainerEarningsRow,
  EntertainerOverview,
  Paginated,
  PayoutRow,
  TransactionRow,
  VenueOverview,
} from "./types";

/**
 * Dashboard aggregates (Phase 7).
 *
 * Every figure the dashboards show comes from here. Nothing is summed on the
 * client: a total derived from one page of a paginated list would look
 * authoritative and be wrong, and this product's whole pitch to venues is
 * numbers they can trust.
 */

/**
 * `null` means the call failed — the caller renders "Not yet available" rather
 * than a zero. A missing number and a number that is genuinely zero must never
 * look the same on a money dashboard.
 */
export type Maybe<T> = T | null;

async function orNull<T>(promise: Promise<T>): Promise<Maybe<T>> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
}

/**
 * `limit` and `offset` are documented as optional, but omitting them makes the
 * backend's ParseIntPipe answer 400 ("numeric string is expected"). Always send
 * them explicitly — verified against the live API on 2026-09-26.
 */
const PAGE = 25;

export const getVenueOverview = (token: string, venueId: string) =>
  orNull(apiFetch<VenueOverview>(`/venues/${venueId}/overview`, { token }));

export const getVenueEntertainerEarnings = (token: string, venueId: string) =>
  orNull(apiFetch<EntertainerEarningsRow[]>(`/venues/${venueId}/entertainer-earnings`, { token }));

export const getVenueTransactions = (
  token: string,
  venueId: string,
  { limit = PAGE, offset = 0 }: { limit?: number; offset?: number } = {},
) =>
  orNull(
    apiFetch<Paginated<TransactionRow>>(
      `/venues/${venueId}/transactions?limit=${limit}&offset=${offset}`,
      { token },
    ),
  );

export const getVenuePayouts = (
  token: string,
  venueId: string,
  { limit = PAGE, offset = 0 }: { limit?: number; offset?: number } = {},
) =>
  orNull(
    apiFetch<Paginated<PayoutRow>>(
      `/venues/${venueId}/payouts?limit=${limit}&offset=${offset}`,
      { token },
    ),
  );

export const getEntertainerOverview = (token: string, entertainerId: string) =>
  orNull(apiFetch<EntertainerOverview>(`/entertainers/${entertainerId}/overview`, { token }));

export const getEntertainerTransactions = (
  token: string,
  entertainerId: string,
  { limit = PAGE, offset = 0 }: { limit?: number; offset?: number } = {},
) =>
  orNull(
    apiFetch<Paginated<TransactionRow>>(
      `/entertainers/${entertainerId}/transactions?limit=${limit}&offset=${offset}`,
      { token },
    ),
  );

export const getEntertainerPayouts = (
  token: string,
  entertainerId: string,
  { limit = PAGE, offset = 0 }: { limit?: number; offset?: number } = {},
) =>
  orNull(
    apiFetch<Paginated<PayoutRow>>(
      `/entertainers/${entertainerId}/payouts?limit=${limit}&offset=${offset}`,
      { token },
    ),
  );
