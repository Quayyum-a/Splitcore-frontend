# Splitcore Frontend

Guest tipping, QR generation, and the venue dashboard for [Splitcore](https://splitcore-api.onrender.com) —
tip an entertainer by scanning a code. No app, no login, no cash.

Next.js (App Router) · TypeScript · Tailwind CSS · deployed on Netlify.

---

## The fix this repo exists to make

The backend's `GET /t/{public_token}` returns **JSON**. A QR code encoding
`https://splitcore-api.onrender.com/t/{token}` therefore opens a wall of raw JSON on a guest's
phone — unusable in a club.

This frontend owns the human-facing route instead:

```
QR code encodes  →  https://<this-frontend>/t/{public_token}
                         │
                         ├── resolves the token server-side against the backend
                         └── renders the tipping screen, then real Paystack checkout
```

Every QR code generated in the dashboard encodes **this site's** URL, built from
`NEXT_PUBLIC_APP_URL` — never a hardcoded domain, and never the backend's. That property is
covered by a decode test: generated PNGs are decoded and asserted to contain the frontend URL.

---

## Backend API

- **Swagger UI:** https://splitcore-api.onrender.com/api/docs — verified rendering
  (2026-09-26). Browse and try every endpoint there.
- **OpenAPI JSON:** https://splitcore-api.onrender.com/api/docs-json — mounted at
  `/api/docs-json`, *not* `/api-json` or `/docs-json`. A snapshot lives at
  [`docs/splitcore-openapi.snapshot.json`](docs/splitcore-openapi.snapshot.json).

---

## Brand

The gold "S" is the locked mark. Source art is in
[`design/reference/`](design/reference/); everything in `public/` is generated from it
(`favicon.ico` + PNG favicons, `apple-touch-icon.png`, maskable manifest icons, the OG
card, and the header mark), lifted off its navy plate into straight alpha so it sits on
any surface.

The wordmark is set as **live type**, not shipped as art — the reference lockup renders
it in cream, which would vanish on the light admin surface.

| Token | Value | Where it comes from |
|---|---|---|
| `--color-ink-950` | `#08080a` | canonical dark ground, matches `theme-color` |
| `--color-gold` | `#c89e5a` | median luminance of the mark's gold pixels |
| `--color-gold-bright` | `#efc568` | the mark's highlight |
| `--color-cream` | `#f2efe9` | the wordmark's off-white |

The gold is an antique bronze sampled from the art, not a bright amber. Type is
**Outfit** throughout — geometric and wide-set, built like the wordmark.

---

## `docs/api-audit.md` is the source of truth

[`docs/api-audit.md`](docs/api-audit.md) records what the live backend **actually** supported on the
date it was written, verified by hitting it rather than by reading status reports. Every route here
cites the endpoint it depends on.

**This README goes stale; the audit's reproduction steps do not.** Before trusting either, re-run
§5 of the audit against the live service. Two prior "status reports" were materially wrong about
what was deployed.

### What's real vs. not yet available

| Area | State |
|---|---|
| Guest tipping `/t/[token]` | ✅ Real — resolves live tokens, distinct 404 / 410 states |
| Payment initialization + Paystack checkout | ✅ Real — `POST /payments/initialize` |
| Payment status incl. pending / refunded / reversed | ✅ Real — polls `GET /payments/{reference}/status` |
| QR generation, download, deactivate, regenerate | ✅ Real |
| Entertainers: add, link to venue, activate/deactivate, KYC | ✅ Real |
| Split rules: active, history, create | ✅ Real |
| Venue "Total Tips" / "Transactions" / "Pending Payouts" | ✅ Real — `GET /venues/{id}/overview` |
| Transaction history + payouts tables (venue) | ✅ Real, paginated |
| Entertainer portal: sign-in link, own dashboard, payout onboarding | ✅ Real |
| Venue-admin view of entertainer KYC status | ✅ Real, read-only |
| Bank picker (live `GET /banks`, no code ever typed) | ✅ Real, both surfaces |
| Venue payout-account onboarding | ✅ Real |
| Venue's own payout history, separate from entertainers' | ✅ Real |
| Platform-admin cross-venue management | ✅ Real — gated on the `role` claim, verified with two live accounts |
| Split rules: platform fee locked, linked venue/entertainer shares | ✅ Real |
| Entertainer approval: propose → consent link → accept/reject | ✅ Built — **switches on by itself** once the backend ships (see below) |
| Platform fee editor + admin override | ✅ Built, platform admin only |
| Spectacle mode | ⛔ No endpoint exists — not built |

Nothing in the dashboard computes an aggregate client-side from partial data. A number is either
fetched from a confirmed endpoint or it is absent, because the product's pitch to venues is
numbers they can trust.

---

## The entertainer portal

Entertainers have no accounts and no password. A venue admin presses **Sign-in link** on the
entertainer roster, which calls `POST /entertainer-auth/login-links/{id}`, and hands over
the resulting URL — there is no notification channel, so the dashboard is the delivery
mechanism. The link is single use and expires in 30 minutes.

**Landing on that URL redeems nothing.** WhatsApp, iMessage and most SMS clients fetch a URL
to build a link preview; burning a single-use token on GET would mean a preview bot spends
the entertainer's only login before they ever tap it. Redemption happens on an explicit tap,
via a server action.

Onboarding runs one step at a time — bank details → resolve → **confirm the name the bank
returned** → identity → done. Which step shows is decided entirely by the backend's derived
`nextStep`; the client never works that out for itself. The confirm step is a real fraud
checkpoint and is never skipped or auto-accepted.

Bank details are entered through a **searchable picker backed by the live `GET /banks` list**
(263 banks). The person picks a name; the provider's code rides along in a hidden input and is
never shown or typed. No bank list is ever hardcoded — codes change, and a wrong one sends
money to the wrong institution. If the list can't be loaded the field says so, rather than
appearing as an empty dropdown.

---

## Two pools of money

A venue's own share and what its entertainers are owed come from **separate endpoints**
(`/venues/{id}/own-payouts` and `/venues/{id}/payouts`) and are rendered as **separate,
visually distinct sections** — never one table. "₦4,750 to DJ Neptune" and "₦4,750 to the
venue" read identically at a glance and mean completely different things to a reconciliation.

The venue's payout account has its own onboarding, mirroring the entertainer flow but without
an identity step: bank details → resolve → **confirm the name the bank returned** → done.

> The overview's `pendingPayoutsKobo` covers **both** pools, per the API's own description, so
> it's labelled that way and no venue-only pending balance is shown. Summing one page of
> queued rows to fill that gap would be a client-side aggregate dressed as a balance.

---

## Split-rule governance, and the capability probe

A split isn't real until the entertainer agrees to it. The dashboard proposes venue and
entertainer shares; the platform fee is server-set and read-only; the proposal sits in
**Awaiting approval**, dividing no money, until the entertainer accepts it via a consent
link at `/split-rules/[id]/respond/[token]` — no login, the token is the authorization.

**The backend for this is committed but not yet deployed.** Rather than shipping a UI that
errors until someone remembers to redeploy, the dashboard probes `GET /platform/settings`
once per render:

| Probe | Mode |
|---|---|
| **200** | Governance. Propose/approve, locked platform fee, real status badges. |
| **404** | Legacy. All three shares are client input, splits take effect immediately — and the page **says so** rather than implying otherwise. |

Nothing needs changing here when the backend ships. It switches on by itself.

---

## Local development

```bash
npm install
cp .env.example .env.local     # then fill in SESSION_SECRET
npm run dev                    # http://localhost:3000
```

Generate a session secret with `openssl rand -base64 32`.

| Variable | Required | Purpose |
|---|---|---|
| `API_BASE_URL` | yes | Backend base URL. **Server-side only** — see "Why everything is proxied". |
| `NEXT_PUBLIC_APP_URL` | yes | This site's canonical origin. Used to build the URL encoded into QR codes. On Netlify it falls back to `$URL` / `$DEPLOY_PRIME_URL`. |
| `SESSION_SECRET` | yes | Encrypts the httpOnly session cookie. ≥32 chars. |

```bash
npm run build        # production build
npm run typecheck    # tsc --noEmit
```

There is no public landing page: `/` redirects to `/login` or `/dashboard`. Guests only ever arrive
at `/t/{token}` from a physical code.

---

## Why everything is proxied server-side

The deployed backend returns **HTTP 500 for any request carrying an `Origin` header** — every
browser origin, including `localhost` (audit §4). So this app never calls the backend from the
browser. All calls run in Server Components, Server Actions, and Route Handlers, where `fetch`
sends no `Origin` — the exact case the backend allows.

Three things follow:

1. The app works **today**, with no backend or Render change required.
2. The backend JWT lives in an **encrypted httpOnly cookie** and is never readable by client JS.
3. `API_BASE_URL` is deliberately **not** `NEXT_PUBLIC_` — the backend URL never ships to the browser.

---

## Deployment (Netlify)

Uses Netlify's official Next.js Runtime (`@netlify/plugin-nextjs`) via `netlify.toml`. **Not** a
static export — `/t/[token]` must be server-rendered per request, since a token's validity changes
the moment a venue deactivates its code.

Set on the Netlify site:

| Variable | Value |
|---|---|
| `API_BASE_URL` | `https://splitcore-api.onrender.com` |
| `NEXT_PUBLIC_APP_URL` | the site's production URL |
| `SESSION_SECRET` | a fresh 32-byte random string |

### Required on the backend (Render), not here

| Key | Value | Why |
|---|---|---|
| `FRONTEND_URL` | `https://splitcore-app.netlify.app` | **Required.** The backend returns guests to `{FRONTEND_URL}/t/{token}?reference=…` after Paystack. Takes precedence over the older `PAYMENT_CALLBACK_URL`. |
| `ALLOWED_ORIGINS` | `https://splitcore-app.netlify.app` | Already set — CORS was verified working on 2026-09-26. |

---

## Layout

```
app/
  t/[token]/            Guest tipping screen, checkout, AND the Paystack return
                        (?reference=… switches it into the confirming state)
  pay/confirming/       Legacy return route, kept for older backend settings
  split-rules/[id]/respond/[token]/
                        Entertainer consent — public, no login, dark-themed
  entertainer/          The entertainer's own portal: earnings + payout onboarding
  entertainer/login/[token]/
                        One-time sign-in link landing
  login/                Venue admin sign-in
  dashboard/            Overview, QR codes, entertainers, split rules,
                        payout account, transactions, payouts,
                        venues (platform admin only)
  api/
    qr/[token]/png/     Scannable PNG encoding this site's /t/ URL
    payments/[reference]/status/   Server-side proxy the confirmation screen polls
lib/
  api/                  Typed client + per-domain modules, shapes from the audit
  money.ts              Integer kobo everywhere; formatNaira is the only formatter
  session.ts            Encrypted httpOnly session cookie
  app-url.ts            Origin resolution + buildTipUrl
docs/
  api-audit.md          Source of truth for what the backend actually supports
```

### Money

Every amount is an **integer number of kobo**, end to end, matching the backend. No floating-point
naira value exists anywhere — guest input is parsed with string arithmetic so `"1234.35"` can't
land on `123434.999`. `formatNaira(kobo)` is the single point where kobo becomes text.
