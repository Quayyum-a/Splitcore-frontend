import "server-only";

import { apiFetch, ApiError } from "./client";
import type { SplitRule, SplitRuleTerms } from "./types";

/**
 * The entertainer's consent endpoints. Public by design — entertainers have no
 * accounts, and requiring one to agree terms would mean nobody ever agrees any.
 * The token in the URL is the authorization.
 */

export type TermsResult =
  | { kind: "ok"; terms: SplitRuleTerms }
  | { kind: "invalid" } // 404: unknown id, wrong token, or already answered
  | { kind: "error"; message: string };

/**
 * The backend returns the same 404 for an unknown id, a wrong token and an
 * already-answered proposal, so this link can't be used to discover which
 * proposals exist. The UI must not try to be more specific than that.
 */
export async function getProposedTerms(
  splitRuleId: string,
  token: string,
): Promise<TermsResult> {
  try {
    const terms = await apiFetch<SplitRuleTerms>(
      `/split-rules/${encodeURIComponent(splitRuleId)}/respond/${encodeURIComponent(token)}`,
      { timeoutMs: 25_000 },
    );
    return { kind: "ok", terms };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) return { kind: "invalid" };
      return { kind: "error", message: error.message };
    }
    throw error;
  }
}

export type RespondResult =
  | { kind: "ok"; rule: SplitRule; decision: "ACCEPT" | "REJECT" }
  | { kind: "invalid" } //  404
  | { kind: "already-answered" } // 409
  | { kind: "error"; message: string };

export async function respondToProposal(
  splitRuleId: string,
  token: string,
  decision: "ACCEPT" | "REJECT",
): Promise<RespondResult> {
  try {
    const rule = await apiFetch<SplitRule>(
      `/split-rules/${encodeURIComponent(splitRuleId)}/respond/${encodeURIComponent(token)}`,
      { method: "POST", body: { decision }, timeoutMs: 25_000 },
    );
    return { kind: "ok", rule, decision };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) return { kind: "invalid" };
      if (error.status === 409) return { kind: "already-answered" };
      return { kind: "error", message: error.message };
    }
    throw error;
  }
}
