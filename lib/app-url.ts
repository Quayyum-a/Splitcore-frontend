/**
 * This frontend's own canonical origin, and the QR target URL built from it.
 *
 * THE CORE FIX (README §"The fix"): a QR code must encode the FRONTEND's
 * /t/{token} URL, never the backend's. The backend's /t/{token} returns raw
 * JSON — scanning a QR that points there shows a guest a wall of JSON.
 *
 * The origin is never hardcoded, so the same build works on localhost, on a
 * Netlify deploy preview, and on a custom domain.
 */

/**
 * Resolution order:
 *   1. NEXT_PUBLIC_APP_URL      — explicit, wins everywhere. Set this in production.
 *   2. URL                      — Netlify's canonical production URL.
 *   3. DEPLOY_PRIME_URL         — Netlify's per-branch/deploy-preview URL.
 *   4. http://localhost:3000    — local dev fallback.
 *
 * NEXT_PUBLIC_* is inlined at build time, so this is safe in client components;
 * the Netlify vars only resolve server-side, which is where QR codes are built.
 */
export function getAppUrl(): string {
  const candidate =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    "http://localhost:3000";

  const trimmed = candidate.trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** The exact string encoded into a scannable QR code. */
export function buildTipUrl(publicToken: string, appUrl: string = getAppUrl()): string {
  return `${appUrl}/t/${encodeURIComponent(publicToken)}`;
}
