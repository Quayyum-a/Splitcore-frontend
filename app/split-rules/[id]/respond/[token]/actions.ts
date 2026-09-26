"use server";

import { respondToProposal, type RespondResult } from "@/lib/api/consent";

/**
 * Runs server-side so the entertainer's decision is posted from our origin with
 * the token never leaving the request path, and so a legacy backend's failure
 * surfaces as a message rather than an unhandled client exception.
 */
export async function respondAction(
  splitRuleId: string,
  token: string,
  decision: "ACCEPT" | "REJECT",
): Promise<RespondResult> {
  return respondToProposal(splitRuleId, token, decision);
}
