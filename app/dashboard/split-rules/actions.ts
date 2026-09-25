"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { createSplitRule } from "@/lib/api/dashboard";
import { requireSession } from "@/lib/session";

export interface SplitRuleFormState {
  error: string | null;
  success: string | null;
}

const TOTAL_BPS = 10_000;

export async function createSplitRuleAction(
  _previous: SplitRuleFormState,
  formData: FormData,
): Promise<SplitRuleFormState> {
  const venueId = String(formData.get("venueId") ?? "").trim();
  const entertainerBps = Number(formData.get("entertainerBps"));
  const venueBps = Number(formData.get("venueBps"));
  const platformBps = Number(formData.get("platformBps"));

  if (!venueId) return { error: "Choose a venue.", success: null };

  const parts = [entertainerBps, venueBps, platformBps];
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > TOTAL_BPS)) {
    return { error: "Each share must be a whole percentage between 0 and 100.", success: null };
  }

  const total = parts.reduce((sum, part) => sum + part, 0);
  if (total !== TOTAL_BPS) {
    return {
      error: `Shares must add up to exactly 100%. They currently total ${(total / 100).toFixed(2)}%.`,
      success: null,
    };
  }

  try {
    const { token } = await requireSession();
    await createSplitRule(token, { venueId, entertainerBps, venueBps, platformBps });
    revalidatePath("/dashboard/split-rules");
    return {
      error: null,
      success: "New split rule is now active. The previous rule has been closed out.",
    };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return { error: "Your session expired. Sign in again.", success: null };
      if (error.status === 403) return { error: "You don't have access to that venue.", success: null };
      return { error: error.message, success: null };
    }
    return { error: "Something went wrong.", success: null };
  }
}
