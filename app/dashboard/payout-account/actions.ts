"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  confirmVenueAccount,
  resolveVenueAccount,
  submitVenueBankDetails,
} from "@/lib/api/venue-payout-account";
import { requireSession } from "@/lib/session";

export interface PayoutAccountState {
  error: string | null;
}

function toMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session expired. Sign in again.";
    if (error.status === 403) return "You don't have access to this venue.";
    if (error.isNetworkError) return "Couldn't reach the Splitcore API. Try again in a moment.";
    // The 400s here carry the backend's own words — "unrecognised or ambiguous
    // bank", "the bank rejected them", "the name does not match". Those are
    // more useful than anything this layer could paraphrase.
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export async function submitVenueBankDetailsAction(
  _previous: PayoutAccountState,
  formData: FormData,
): Promise<PayoutAccountState> {
  const venueId = String(formData.get("venueId") ?? "");
  const bankCode = String(formData.get("bankCode") ?? "").trim();
  const accountNumber = String(formData.get("accountNumber") ?? "").trim();

  if (!venueId) return { error: "Choose a venue." };
  if (!bankCode) return { error: "Choose the bank from the list." };
  if (!/^\d{10}$/.test(accountNumber)) {
    return { error: "A Nigerian account number is exactly 10 digits." };
  }

  try {
    const { token } = await requireSession();
    await submitVenueBankDetails(token, venueId, { bankCode, accountNumber });
    revalidatePath("/dashboard/payout-account");
    return { error: null };
  } catch (error) {
    return { error: toMessage(error) };
  }
}

export async function resolveVenueAccountAction(
  _previous: PayoutAccountState,
  formData: FormData,
): Promise<PayoutAccountState> {
  const venueId = String(formData.get("venueId") ?? "");
  try {
    const { token } = await requireSession();
    await resolveVenueAccount(token, venueId);
    revalidatePath("/dashboard/payout-account");
    return { error: null };
  } catch (error) {
    return { error: toMessage(error) };
  }
}

/**
 * The fraud checkpoint. Posts back the name the bank returned, as shown on the
 * screen; the backend re-checks it against its own record so a stale page
 * cannot confirm an account that has since been changed underneath it.
 */
export async function confirmVenueAccountAction(
  _previous: PayoutAccountState,
  formData: FormData,
): Promise<PayoutAccountState> {
  const venueId = String(formData.get("venueId") ?? "");
  const confirmedAccountName = String(formData.get("confirmedAccountName") ?? "").trim();
  if (!confirmedAccountName) return { error: "Nothing to confirm yet." };

  try {
    const { token } = await requireSession();
    await confirmVenueAccount(token, venueId, confirmedAccountName);
    revalidatePath("/dashboard/payout-account");
    revalidatePath("/dashboard/payouts");
    return { error: null };
  } catch (error) {
    return { error: toMessage(error) };
  }
}
