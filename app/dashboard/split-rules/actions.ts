"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  createSplitRuleLegacy,
  overrideSplitRule,
  proposeSplitRule,
  updatePlatformSettings,
} from "@/lib/api/dashboard";
import { requirePlatformAdmin, requireSession } from "@/lib/session";

const TOTAL_BPS = 10_000;

export interface SplitRuleFormState {
  error: string | null;
  success: string | null;
  /** Shown once and never retrievable — the venue must deliver it themselves. */
  consentUrl?: string;
  entertainerName?: string;
}

function toMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session expired. Sign in again.";
    if (error.status === 403) return "You don't have access to that venue.";
    // The server is the authority on which combinations it accepts, and it may
    // be stricter than this form knows. Surface its own words.
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

/**
 * Governance API: propose venue + entertainer shares for the entertainer to accept.
 *
 * platformBps is deliberately never sent — the endpoint rejects a payload
 * containing it with a 400, because the platform's cut is server-side only.
 */
export async function proposeSplitRuleAction(
  _previous: SplitRuleFormState,
  formData: FormData,
): Promise<SplitRuleFormState> {
  const venueId = String(formData.get("venueId") ?? "").trim();
  const entertainerId = String(formData.get("entertainerId") ?? "").trim();
  const entertainerName = String(formData.get("entertainerName") ?? "").trim();
  const entertainerBps = Number(formData.get("entertainerBps"));
  const venueBps = Number(formData.get("venueBps"));
  const splittableBps = Number(formData.get("splittableBps"));

  if (!venueId) return { error: "Choose a venue.", success: null };
  if (!entertainerId) {
    return { error: "Choose the entertainer who needs to agree these terms.", success: null };
  }
  if (![entertainerBps, venueBps].every((n) => Number.isInteger(n) && n >= 0)) {
    return { error: "Shares must be whole percentages.", success: null };
  }
  if (entertainerBps + venueBps !== splittableBps) {
    return {
      error: `Venue and entertainer shares must total ${(splittableBps / 100).toFixed(2)}%.`,
      success: null,
    };
  }

  try {
    const { token } = await requireSession();
    const proposal = await proposeSplitRule(token, {
      venueId,
      entertainerId,
      entertainerBps,
      venueBps,
    });
    revalidatePath("/dashboard/split-rules");
    return {
      error: null,
      success: "Proposal sent. It divides no money until the entertainer accepts.",
      consentUrl: proposal.consentUrl,
      entertainerName,
    };
  } catch (error) {
    return { error: toMessage(error), success: null };
  }
}

/**
 * PLATFORM_ADMIN only. Bypasses entertainer consent and takes effect at once.
 * Stamped ADMIN_OVERRIDE with the reason in the immutable audit trail, so it can
 * never be mistaken for terms an entertainer agreed to.
 */
export async function overrideSplitRuleAction(
  _previous: SplitRuleFormState,
  formData: FormData,
): Promise<SplitRuleFormState> {
  const venueId = String(formData.get("venueId") ?? "").trim();
  const entertainerBps = Number(formData.get("entertainerBps"));
  const venueBps = Number(formData.get("venueBps"));
  const platformBps = Number(formData.get("platformBps"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (reason.length < 10) {
    return {
      error: "Give a reason of at least 10 characters. It goes in the audit trail.",
      success: null,
    };
  }
  const total = entertainerBps + venueBps + platformBps;
  if (total !== TOTAL_BPS) {
    return {
      error: `Shares must total exactly 100%. They currently total ${(total / 100).toFixed(2)}%.`,
      success: null,
    };
  }

  try {
    const { token } = await requirePlatformAdmin();
    await overrideSplitRule(token, {
      venueId,
      entertainerBps,
      venueBps,
      platformBps,
      reason,
    });
    revalidatePath("/dashboard/split-rules");
    return {
      error: null,
      success: "Override applied. It is active now and recorded as ADMIN_OVERRIDE.",
    };
  } catch (error) {
    return { error: toMessage(error), success: null };
  }
}

/** PLATFORM_ADMIN only. Applies to rules proposed from now on, not existing ones. */
export async function updatePlatformFeeAction(
  _previous: SplitRuleFormState,
  formData: FormData,
): Promise<SplitRuleFormState> {
  const platformFeeBps = Number(formData.get("platformFeeBps"));

  if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 9000) {
    return { error: "The platform fee must be between 0% and 90%.", success: null };
  }

  try {
    const { token } = await requirePlatformAdmin();
    await updatePlatformSettings(token, platformFeeBps);
    revalidatePath("/dashboard/split-rules");
    return {
      error: null,
      success: `Platform fee is now ${(platformFeeBps / 100).toFixed(2)}%. Splits already in force keep the fee they were agreed under.`,
    };
  } catch (error) {
    return { error: toMessage(error), success: null };
  }
}

/**
 * LEGACY path, used only when GET /platform/settings 404s — i.e. the deployed
 * backend predates governance. All three shares come from the client and the
 * rule takes effect immediately, with no entertainer consent.
 */
export async function createSplitRuleLegacyAction(
  _previous: SplitRuleFormState,
  formData: FormData,
): Promise<SplitRuleFormState> {
  const venueId = String(formData.get("venueId") ?? "").trim();
  const entertainerBps = Number(formData.get("entertainerBps"));
  const venueBps = Number(formData.get("venueBps"));
  const platformBps = Number(formData.get("platformBps"));

  if (!venueId) return { error: "Choose a venue.", success: null };

  const parts = [entertainerBps, venueBps, platformBps];
  if (parts.some((p) => !Number.isInteger(p) || p < 0 || p > TOTAL_BPS)) {
    return { error: "Each share must be between 0% and 100%.", success: null };
  }
  if (parts.reduce((a, b) => a + b, 0) !== TOTAL_BPS) {
    return { error: "Shares must total exactly 100%.", success: null };
  }

  try {
    const { token } = await requireSession();
    await createSplitRuleLegacy(token, { venueId, entertainerBps, venueBps, platformBps });
    revalidatePath("/dashboard/split-rules");
    return {
      error: null,
      success: "New split saved. It is active now, and the previous rule is closed.",
    };
  } catch (error) {
    return { error: toMessage(error), success: null };
  }
}
