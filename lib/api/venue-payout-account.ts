import "server-only";

import { apiFetch } from "./client";
import type { Paginated, PayoutRow, VenuePayoutAccount } from "./types";

/**
 * The venue's own payout account, and its own payouts.
 *
 * Kept apart from `lib/api/insights.ts` (which serves the entertainer-facing
 * lists) for the same reason the backend split the endpoints: these are two
 * different pools of money with two different destinations, and code that
 * treats them as interchangeable is how they end up rendered as one list.
 */

export const getVenuePayoutAccount = (token: string, venueId: string) =>
  apiFetch<VenuePayoutAccount>(`/venues/${venueId}/payout-account/status`, { token });

/** Step 1. Changing the account clears any previous resolution and confirmation. */
export const submitVenueBankDetails = (
  token: string,
  venueId: string,
  body: { bankCode: string; accountNumber: string },
) =>
  apiFetch<VenuePayoutAccount>(`/venues/${venueId}/payout-account/bank-details`, {
    method: "POST",
    token,
    body,
  });

/** Step 2. Asks the bank who owns the account. */
export const resolveVenueAccount = (token: string, venueId: string) =>
  apiFetch<VenuePayoutAccount>(`/venues/${venueId}/payout-account/resolve-account`, {
    method: "POST",
    token,
  });

/**
 * Step 3. The name must match what the bank returned. Once confirmed the
 * venue's VENUE_PAYABLE balance becomes payable and the sweep picks it up.
 */
export const confirmVenueAccount = (
  token: string,
  venueId: string,
  confirmedAccountName: string,
) =>
  apiFetch<VenuePayoutAccount>(`/venues/${venueId}/payout-account/confirm-account`, {
    method: "POST",
    token,
    body: { confirmedAccountName },
  });

/**
 * The venue's OWN payout history — its share, not its entertainers'. A separate
 * endpoint by design, so the two can never be rendered as one set of rows.
 */
export const getVenueOwnPayouts = (
  token: string,
  venueId: string,
  { limit = 25, offset = 0 }: { limit?: number; offset?: number } = {},
) =>
  apiFetch<Paginated<PayoutRow>>(
    `/venues/${venueId}/own-payouts?limit=${limit}&offset=${offset}`,
    { token },
  );
