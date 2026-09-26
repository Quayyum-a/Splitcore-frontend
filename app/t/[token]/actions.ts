"use server";

import { cookies } from "next/headers";

import { ApiError } from "@/lib/api/client";
import { initializePayment, resolveToken } from "@/lib/api/guest";
import { validateTipKobo } from "@/lib/money";

/**
 * Starts a real payment against POST /payments/initialize (confirmed live —
 * docs/api-audit.md §3.3) and hands back Paystack's hosted checkout URL.
 *
 * Runs as a server action because the backend rejects any browser-origin
 * request outright (§4.4). It also means the sessionId never has to be trusted
 * from the client: we re-resolve the token server-side rather than accepting a
 * sessionId the page posted to us.
 */

export type StartPaymentResult =
  | { ok: true; authorizationUrl: string; reference: string }
  | { ok: false; error: string; retryable: boolean };

export interface StartPaymentInput {
  token: string;
  amountKobo: number;
  displayNameEnabled: boolean;
  guestDisplayName?: string;
  email?: string;
}

/** Lets /pay/confirming recover the reference if the callback loses its query string. */
const LAST_REFERENCE_COOKIE = "splitcore_last_reference";
/** Lets the "Try Again" button on a failed payment return to the right QR token. */
const LAST_TOKEN_COOKIE = "splitcore_last_token";

export async function startPayment(input: StartPaymentInput): Promise<StartPaymentResult> {
  const amountError = validateTipKobo(input.amountKobo);
  if (amountError) return { ok: false, error: amountError, retryable: true };

  // Guest sessions expire (QrResolution.expiresAt). Re-resolving immediately
  // before paying means a guest who left the screen open on a table for an
  // hour gets a fresh session instead of an opaque 410 from the payment call.
  const resolution = await resolveToken(input.token);
  if (resolution.kind === "not-found") {
    return { ok: false, error: "This tipping link isn't valid.", retryable: false };
  }
  if (resolution.kind === "gone") {
    return { ok: false, error: "This tipping link is no longer active.", retryable: false };
  }
  if (resolution.kind === "error") {
    return {
      ok: false,
      error: "We couldn't reach Splitcore. Check your connection and try again.",
      retryable: true,
    };
  }

  const displayName = input.guestDisplayName?.trim();

  try {
    const payment = await initializePayment({
      sessionId: resolution.data.sessionId,
      amountKobo: input.amountKobo,
      displayNameEnabled: input.displayNameEnabled,
      ...(input.displayNameEnabled && displayName ? { guestDisplayName: displayName } : {}),
      ...(input.email?.trim() ? { email: input.email.trim() } : {}),
    });

    const store = await cookies();
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60, // an hour is far longer than any checkout takes
    };
    store.set(LAST_REFERENCE_COOKIE, payment.reference, cookieOptions);
    store.set(LAST_TOKEN_COOKIE, input.token, cookieOptions);

    return {
      ok: true,
      authorizationUrl: payment.authorizationUrl,
      reference: payment.reference,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      // The backend refuses payments for a venue with no active split rule
      // (§3.3). That is an operator misconfiguration, not guest error — say so
      // plainly instead of showing a validation message the guest can't act on.
      if (error.status === 400 && /split rule/i.test(error.message)) {
        return {
          ok: false,
          error: "This venue isn't set up to receive tips yet. Please let the venue know.",
          retryable: false,
        };
      }
      if (error.status === 410) {
        return { ok: false, error: "This tipping link is no longer active.", retryable: false };
      }
      if (error.status === 404) {
        return {
          ok: false,
          error: "Your session expired. Please scan the code again.",
          retryable: false,
        };
      }
      if (error.isNetworkError) {
        return {
          ok: false,
          error: "We couldn't reach Splitcore. Check your connection and try again.",
          retryable: true,
        };
      }
      // A server fault is not the guest's problem to interpret. Passing the
      // backend's own words through put "An unexpected error occurred" in front
      // of someone standing in a club holding their phone — true, and useless.
      // Tell them what to do instead, and don't imply retrying will help.
      if (error.status >= 500) {
        return {
          ok: false,
          error: "Tips aren't going through right now. Please let the venue know — this is on us, not you.",
          retryable: false,
        };
      }
      return { ok: false, error: error.message, retryable: true };
    }
    return { ok: false, error: "Something went wrong. Please try again.", retryable: true };
  }
}
