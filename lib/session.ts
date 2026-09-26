import "server-only";

import { cookies } from "next/headers";
import { EncryptJWT, jwtDecrypt } from "jose";

import { tokenExpiryMs } from "./api/auth";
import type { SessionUser } from "./api/types";

/**
 * Venue-admin session storage.
 *
 * DECISION: the backend's JWT is held in an **encrypted httpOnly cookie**, never
 * in localStorage and never in client-readable JS.
 *
 * Why: the backend issues a bare access token with no refresh endpoint
 * (docs/api-audit.md §2 — there is no /auth/refresh and no /auth/me), so the
 * frontend cannot invent a refresh rotation it has no support for. Given a
 * single long-lived token, the priority is keeping it unreadable by scripts.
 * An httpOnly cookie does that; localStorage does the opposite. It also happens
 * to be the only mechanism compatible with the server-side proxying that the
 * backend's broken CORS forces on us anyway (§4.4).
 *
 * The cookie is encrypted (JWE, A256GCM) rather than merely signed so the
 * backend token is not readable even if the cookie leaks into a log or a
 * shared browser profile.
 */

const COOKIE_NAME = "splitcore_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8h ceiling; the JWT's own exp wins if sooner.

export interface Session {
  token: string;
  user: SessionUser;
}

let cachedKey: Uint8Array | null = null;

function secretKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters. " +
        "Generate one with `openssl rand -base64 32` and set it in the environment.",
    );
  }
  // Derive a fixed 32-byte key from whatever length secret was supplied.
  cachedKey = new Uint8Array(
    require("node:crypto").createHash("sha256").update(secret).digest(),
  );
  return cachedKey;
}

export async function createSession(token: string, user: SessionUser): Promise<void> {
  const jwtExpiry = tokenExpiryMs(token);
  const ceiling = Date.now() + MAX_AGE_SECONDS * 1000;
  const expiresAt = jwtExpiry === null ? ceiling : Math.min(jwtExpiry, ceiling);
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));

  const sealed = await new EncryptJWT({ token, user })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .encrypt(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const sealed = store.get(COOKIE_NAME)?.value;
  if (!sealed) return null;

  try {
    const { payload } = await jwtDecrypt(sealed, secretKey());
    const token = payload.token;
    if (typeof token !== "string" || token.length === 0) return null;

    // Belt and braces: refuse a session whose backend token has already expired.
    const expiry = tokenExpiryMs(token);
    if (expiry !== null && expiry <= Date.now()) return null;

    return { token, user: (payload.user ?? {}) as SessionUser };
  } catch {
    // Tampered, expired, or encrypted under a rotated secret.
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Session or throw — for server code that must not proceed unauthenticated. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function isPlatformAdmin(): Promise<boolean> {
  return (await getSession())?.user.role === "PLATFORM_ADMIN";
}

/**
 * Platform-admin session or throw.
 *
 * This gate decides what we bother rendering and calling — it is not the
 * security boundary. The role is a claim inside a JWT the backend signed, and
 * every venue mutation is authorised again server-side, so forging it yields a
 * 403 rather than access.
 */
export async function requirePlatformAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "PLATFORM_ADMIN") throw new Error("FORBIDDEN");
  return session;
}
