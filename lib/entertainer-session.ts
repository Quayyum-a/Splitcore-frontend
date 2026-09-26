import "server-only";

import { cookies } from "next/headers";
import { EncryptJWT, jwtDecrypt } from "jose";

import { tokenExpiryMs } from "./api/auth";
import { apiFetch } from "./api/client";
import type { EntertainerSession } from "./api/types";

/**
 * The entertainer's own session.
 *
 * Deliberately a SEPARATE cookie from the venue-admin session: the two are
 * different people with different privileges, and a shared cookie name would
 * mean signing into one silently signs you out of the other. A venue manager
 * demonstrating the portal on their own phone should not lose their dashboard.
 *
 * The backend's token is ENTERTAINER-scoped, read-only and lasts 12 hours. As
 * with the admin session it is held encrypted and httpOnly, so client script
 * can never read it, and every call is re-authorised by the backend regardless.
 */

const COOKIE_NAME = "splitcore_entertainer";
const MAX_AGE_SECONDS = 60 * 60 * 12; // matches the backend's 12h token

export interface EntertainerSessionData {
  token: string;
  entertainerId: string;
  stageName: string;
}

let cachedKey: Uint8Array | null = null;

function secretKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters. " +
        "Generate one with `openssl rand -base64 32`.",
    );
  }
  cachedKey = new Uint8Array(
    require("node:crypto").createHash("sha256").update(secret).digest(),
  );
  return cachedKey;
}

/**
 * Redeems a one-time login link. Single use — the token is burned here, so this
 * must run exactly once per link, and never from a component that might render
 * twice. Expired, already-used and unknown tokens all answer 401 identically,
 * so the UI must not try to be more specific than "this link isn't valid".
 */
export async function redeemLoginLink(
  token: string,
): Promise<EntertainerSessionData | null> {
  try {
    const session = await apiFetch<EntertainerSession>("/entertainer-auth/sessions", {
      method: "POST",
      body: { token },
      timeoutMs: 25_000,
    });
    return {
      token: session.accessToken,
      entertainerId: session.entertainerId,
      stageName: session.stageName,
    };
  } catch {
    return null;
  }
}

export async function createEntertainerSession(
  data: EntertainerSessionData,
): Promise<void> {
  const jwtExpiry = tokenExpiryMs(data.token);
  const ceiling = Date.now() + MAX_AGE_SECONDS * 1000;
  const expiresAt = jwtExpiry === null ? ceiling : Math.min(jwtExpiry, ceiling);
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));

  const sealed = await new EncryptJWT({ ...data })
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

export async function getEntertainerSession(): Promise<EntertainerSessionData | null> {
  const store = await cookies();
  const sealed = store.get(COOKIE_NAME)?.value;
  if (!sealed) return null;

  try {
    const { payload } = await jwtDecrypt(sealed, secretKey());
    const { token, entertainerId, stageName } = payload as Record<string, unknown>;
    if (typeof token !== "string" || typeof entertainerId !== "string") return null;

    // Refuse a session whose backend token has already expired.
    const expiry = tokenExpiryMs(token);
    if (expiry !== null && expiry <= Date.now()) return null;

    return {
      token,
      entertainerId,
      stageName: typeof stageName === "string" ? stageName : "",
    };
  } catch {
    return null;
  }
}

export async function destroyEntertainerSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
