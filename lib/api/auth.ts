import "server-only";

import { decodeJwt } from "jose";

import { apiFetch } from "./client";
import { isRole, type SessionUser } from "./types";

/**
 * POST /auth/login.
 *
 * CONFIRMED SHAPE: the endpoint returns exactly `{ accessToken: string }` —
 * no user object, despite the OpenAPI description mentioning "user details".
 * Everything about the caller (id, email, role) lives in the JWT's own claims:
 * `{ sub, email, role }`. There is no GET /auth/me to ask instead.
 *
 * Token extraction still accepts a few aliases. That tolerance costs nothing
 * and means a backend that later wraps its response doesn't take login down.
 */

export interface LoginResult {
  token: string;
  user: SessionUser;
}

const TOKEN_KEYS = ["accessToken", "access_token", "token", "jwt"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function findToken(payload: unknown): string | null {
  const root = asRecord(payload);
  if (!root) return null;

  for (const candidate of [root, asRecord(root.data), asRecord(root.result)]) {
    if (!candidate) continue;
    for (const key of TOKEN_KEYS) {
      const value = candidate[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  return null;
}

/**
 * Read identity from the JWT's claims.
 *
 * These are read for display and for deciding which navigation to render only.
 * The backend remains the sole authority on access: every protected call still
 * carries the token and is authorised server-side, so a tampered claim buys
 * nothing but a menu item that 403s.
 */
function userFromToken(token: string): SessionUser {
  try {
    const claims = decodeJwt(token) as Record<string, unknown>;
    return {
      id: typeof claims.sub === "string" ? claims.sub : undefined,
      email: typeof claims.email === "string" ? claims.email : undefined,
      role: isRole(claims.role) ? claims.role : undefined,
    };
  } catch {
    return {};
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
        "See docs/api-audit.md for the expected shape.",
    );
  }

  return { token, user: userFromToken(token) };
}

/** Backend JWT expiry as epoch ms, or null when the token carries no `exp`. */
export function tokenExpiryMs(token: string): number | null {
  try {
    const { exp } = decodeJwt(token);
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}
