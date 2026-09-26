import "server-only";

import { decodeJwt } from "jose";

import { apiFetch } from "./client";
import type { SessionUser } from "./types";

/**
 * POST /auth/login.
 *
 * ⚠️ The backend's OpenAPI document does NOT declare the 200 response shape
 * (docs/api-audit.md §3.1) — it only says "Returns JWT access token and user
 * details" — and we hold no valid credentials, so it could not be observed.
 *
 * This is the one place in the codebase that guesses, so it guesses tolerantly:
 * it accepts the token under any plausible key rather than assuming one and
 * breaking on contact with the real response. Once real credentials exist,
 * observe the response and tighten this into an exact type.
 */

export interface LoginResult {
  token: string;
  user: SessionUser;
}

const TOKEN_KEYS = ["accessToken", "access_token", "token", "jwt", "idToken"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function findToken(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) return null;

  // Check the root, then one level down under common envelope keys.
  const candidates = [root, asRecord(root.data), asRecord(root.result)].filter(
    (c): c is Record<string, unknown> => c !== null,
  );

  for (const candidate of candidates) {
    for (const key of TOKEN_KEYS) {
      const value = candidate[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  return null;
}

function findUser(payload: unknown, token: string): SessionUser {
  const root = asRecord(payload);
  const explicit =
    asRecord(root?.user) ?? asRecord(asRecord(root?.data)?.user) ?? null;

  const fromBody: SessionUser = explicit
    ? {
        id: typeof explicit.id === "string" ? explicit.id : undefined,
        email: typeof explicit.email === "string" ? explicit.email : undefined,
        role: typeof explicit.role === "string" ? explicit.role : undefined,
        venueId: typeof explicit.venueId === "string" ? explicit.venueId : null,
      }
    : {};

  // The JWT itself is a reliable secondary source — there is no GET /auth/me
  // to ask instead (docs/api-audit.md §2). We only *read* these claims for
  // display and routing; the backend remains the sole authority on access.
  try {
    const claims = decodeJwt(token) as Record<string, unknown>;
    return {
      id: fromBody.id ?? (typeof claims.sub === "string" ? claims.sub : undefined),
      email:
        fromBody.email ?? (typeof claims.email === "string" ? claims.email : undefined),
      role: fromBody.role ?? (typeof claims.role === "string" ? claims.role : undefined),
      venueId:
        fromBody.venueId ?? (typeof claims.venueId === "string" ? claims.venueId : null),
    };
  } catch {
    return fromBody;
  }
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const payload = await apiFetch<unknown>("/auth/login", {
    method: "POST",
    body: { email, password },
    timeoutMs: 30_000,
  });

  const token = findToken(payload);
  if (!token) {
    throw new Error(
      "Login succeeded but no access token was found in the response. " +
        "The backend's login response shape may have changed — see docs/api-audit.md §3.1.",
    );
  }

  return { token, user: findUser(payload, token) };
}

/** Backend JWT expiry, as epoch ms, or null when the token carries no `exp`. */
export function tokenExpiryMs(token: string): number | null {
  try {
    const { exp } = decodeJwt(token);
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}
