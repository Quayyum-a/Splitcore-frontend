# Splitcore Live API Audit

**Audited:** 2026-09-25
**Target:** `https://splitcore-api.onrender.com`
**Method:** Live HTTPS probes + the deployed OpenAPI document at `GET /api/docs-json`
(snapshotted in this repo as [`splitcore-openapi.snapshot.json`](./splitcore-openapi.snapshot.json)).

> This file is the **source of truth** for what the backend actually supports. It reflects the
> deployment *as of the date above*. It was produced by hitting the live service, not by reading
> status reports. Re-run the probes below before trusting it in a later session.

---

## 0. Headline findings

| # | Finding | Impact |
|---|---|---|
| 1 | **CORS is broken for every browser origin** — any request carrying an `Origin` header returns **HTTP 500**, including `http://localhost:3000`. | Blocker for direct browser→API calls. Worked around architecturally (§6); still needs a backend/ops fix. |
| 2 | Payments **are** built and live (`/payments/initialize`, `/payments/{reference}/status`). | Guest flow can complete a **real** payment. Nothing is faked. |
| 3 | Split rules **are** built and live. | Split-rule config ships as real UI, not "Coming soon". |
| 4 | **No transactions-list, payouts, or aggregate-totals endpoint exists.** | Dashboard money tiles + history/payout tables ship as honest "Not yet available". |
| 5 | `POST /payments/initialize` returns **both** `authorizationUrl` and `accessCode`. | Redirect chosen over Inline (§4.3). |
| 6 | Docs are mounted at `/api/docs` and `/api/docs-json` (not `/docs-json` or `/api-json`). | — |

Prior status reports claiming "Guest + Split Rules not started" are **out of date**: both are deployed and working.

---

## 1. Service health

```bash
curl -s https://splitcore-api.onrender.com/health
```
```json
{"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"}},
 "error":{},"details":{"database":{"status":"up"},"redis":{"status":"up"}}}
```
→ **200**. Postgres and Redis both up. Note: Render free-tier cold starts can take 30–60s on first hit.

---

## 2. Complete endpoint inventory

Auth model: HTTP bearer JWT (`components.securitySchemes.JWT`). There is **no global security requirement** —
each route opts in individually, so "no `security` block" genuinely means public.

| Method | Path | Auth | Status |
|---|---|---|---|
| POST | `/auth/login` | public | ✅ live |
| GET | `/health` | public | ✅ live |
| GET | `/t/{publicToken}` | public | ✅ live |
| POST | `/payments/initialize` | public | ✅ live |
| GET | `/payments/{reference}/status` | public | ✅ live |
| POST · GET | `/venues` | JWT | ✅ live |
| GET · PATCH · DELETE | `/venues/{venueId}` | JWT | ✅ live |
| POST · GET | `/entertainers` | JWT | ✅ live |
| GET · PATCH · DELETE | `/entertainers/{entertainerId}` | JWT | ✅ live |
| POST · DELETE | `/entertainers/{entertainerId}/venues/{venueId}` | JWT | ✅ live (link/unlink) |
| POST · GET | `/qr-codes` | JWT | ✅ live |
| GET · DELETE | `/qr-codes/{qrCodeId}` | JWT | ✅ live |
| POST | `/qr-codes/{qrCodeId}/regenerate` | JWT | ✅ live |
| POST | `/split-rules` | JWT | ✅ live |
| GET | `/split-rules/venue/{venueId}` | JWT | ✅ live (history) |
| GET | `/split-rules/venue/{venueId}/active` | JWT | ✅ live |

### Endpoints that DO NOT exist

Confirmed absent from the deployed OpenAPI document. **No UI may invent these numbers.**

- ❌ Transactions / tip history list (venue- or entertainer-scoped)
- ❌ Payouts list or payout status
- ❌ Aggregate totals ("tonight", "this week", "total") for venue or entertainer
- ❌ `GET /auth/me` or any token-introspection / current-user route
- ❌ Per-venue tip min/max configuration
- ❌ Spectacle-mode flag or any venue-screen display endpoint
- ❌ Split-rule update/delete, or fetch-single-rule by id

---

## 3. Confirmed request/response shapes

### 3.1 `POST /auth/login` — public

Request (`LoginDto`): `{ "email": string, "password": string /* min 8 */ }`

Live probe with the documented example credentials:
```bash
curl -s -X POST .../auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@splitcore.com","password":"Admin123!"}'
# 401 {"statusCode":401,"error":"UnauthorizedException","message":"Invalid email or password",...}
```

⚠️ **The 200 response shape is NOT declared in the OpenAPI document** and we hold no valid
credentials, so it could not be observed directly. The documented description is:
*"Login successful. Returns JWT access token and user details."*

**Consequence for the client:** the login response parser is written **defensively** — it accepts the
token under any of `accessToken` / `access_token` / `token` / `jwt`, and the user object under
`user` / `data.user` / the root. See `lib/api/auth.ts`. This is the single place in the codebase that
guesses, and it guesses tolerantly rather than assuming one shape. **Re-verify once real credentials
exist** and tighten the type.

Errors: `400` validation, `401` invalid credentials.

### 3.2 `GET /t/{publicToken}` — public — **the QR landing endpoint**

Returns **JSON**, not a rendered page. This is exactly why the human-facing `/t/[token]` route must
live on the frontend (see repo README §"The fix").

`200` (`QrResolutionResponseDto`) — **resolving a token also creates a guest session**:
```jsonc
{
  "venue":       { "id": string, "name": string, "logoUrl": string|null, "location": string },
  "entertainer": { "id": string, "stageName": string } | null,   // nullable: venue-level QR
  "location":    "Table 5",          // physical spot the QR sticker sits at
  "sessionId":   "session-uuid",     // REQUIRED to initialize a payment
  "expiresAt":   "2026-01-16T10:30:00Z"
}
```

Error states — **verified distinct on the live service**:
```bash
curl -s -o /dev/null -w '%{http_code}' .../t/bogustoken123   # → 404
```
- `404` `"QR code not found"` → token does not exist → UI: *"This tipping link isn't valid."*
- `410` Gone → QR code, venue, **or** entertainer deactivated → UI: *"This tipping link is no longer active."*

404 was observed live. 410 is declared in the OpenAPI document but could not be triggered without a
known-deactivated token; the client handles it explicitly and distinctly regardless.

### 3.3 `POST /payments/initialize` — public — ✅ **real payments exist**

OpenAPI description, verbatim:
> Creates a payment transaction and returns Paystack checkout URL. Guest will be redirected to
> Paystack's hosted page to complete payment. **CRITICAL: Requires active split rule for venue —
> will reject payment if missing.**

Request (`InitializePaymentDto`):
```jsonc
{
  "sessionId":          string,   // REQUIRED — from the /t/{token} resolution above
  "amountKobo":         number,   // REQUIRED — integer kobo, min 10000 (₦100), max 1000000000 (₦10,000,000)
  "guestDisplayName":   string,   // optional
  "displayNameEnabled": boolean,  // optional, default false
  "email":              string    // optional, for the Paystack receipt
}
```

Response `200` (`PaymentInitResponseDto`):
```jsonc
{
  "transactionId":    string,
  "reference":        "pay_1234567890abcdef",          // OUR reference, not Paystack's
  "authorizationUrl": "https://checkout.paystack.com/...", // redirect the guest here
  "accessCode":       "abcdef123456",                  // would drive Paystack Inline instead
  "amountKobo":       number,
  "status":           "CREATED"
}
```

Errors (verified live): `400` invalid request **or venue has no active split rule**,
`404` `"Guest session not found"` (observed), `410` session expired / entity deactivated.

> **Operational note:** a venue with no active split rule cannot take tips at all. The dashboard's
> split-rule screen is therefore a prerequisite for going live at a venue, not a nice-to-have.

### 3.4 `GET /payments/{reference}/status` — public

OpenAPI description, verbatim:
> Checks current payment status. For CREATED/PENDING payments, explicitly verifies with Paystack API.
> This is the fallback when webhook hasn't fired yet. **DO NOT trust client-side redirect alone as
> proof of payment.**

Response `200` (`PaymentStatusResponseDto`):
```jsonc
{
  "transactionId":   string,
  "reference":       string,
  "status":          "CREATED"|"PENDING"|"SUCCESS"|"FAILED"|"ABANDONED"|"REVERSED"|"REFUNDED",
  "amountKobo":      number,
  "venueName":       string,
  "entertainerName": string | null,
  "createdAt":       ISO8601,
  "updatedAt":       ISO8601
}
```
`404` `"Payment not found"` (observed live).

All seven status values are rendered distinctly by the frontend. `CREATED`/`PENDING` drive the
neutral "confirming your payment…" state — never collapsed into success or failure.

### 3.5 Dashboard resources

- **Venues** (`VenueResponseDto`): `id, name, slug, logoUrl|null, location, isActive, createdAt, updatedAt`.
  Create requires `name, slug, location`. **`POST /venues` is Platform-Admin only.**
- **Entertainers** (`EntertainerResponseDto`): `id, stageName, legalName, phone, bankName|null,
  accountNumber|null, kycStatus, isActive, createdAt, updatedAt, venueIds[]`.
  `kycStatus` ∈ `NOT_STARTED | PENDING | VERIFIED | FAILED | REVIEW | SUSPENDED`.
  Create requires `stageName, legalName, phone` (E.164, unique).
- **QR codes** (`QrCodeResponseDto`): `id, publicToken, venueId, entertainerId|null, location,
  isActive, deactivatedAt|null, createdAt, updatedAt`, optionally embedding `venue` / `entertainer`.
  Create (`CreateQrCodeDto`) requires `venueId` + `location`; `entertainerId` optional
  (omit it for a venue-level QR). **The backend returns a `publicToken`, not an image** — rendering
  the scannable code is the frontend's job, and it must encode the *frontend's* URL.
- **Split rules** (`SplitRuleResponseDto`): `id, venueId, entertainerBps, venueBps, platformBps,
  effectiveFrom, effectiveTo|null, createdAt, updatedAt`. Shares are **basis points** (10000 = 100%).
  Creating a rule **closes out the currently-active rule** — it is append-only versioned history,
  there is no update or delete.

`GET /venues` without a token returns `401 UnauthorizedException` (verified live).

---

## 4. CORS — verified broken

### 4.1 The probe

```bash
curl -s https://splitcore-api.onrender.com/health -H "Origin: http://localhost:3000"
# {"statusCode":500,"error":"InternalServerError","message":"An unexpected error occurred",...}

curl -s https://splitcore-api.onrender.com/health
# {"status":"ok",...}   ← identical request WITHOUT Origin: 200
```

Every origin tested returned **500**, not a clean CORS rejection:

| Origin | Result |
|---|---|
| `https://splitcore-app.netlify.app` | **500** |
| `http://localhost:3000` | **500** |
| `https://example.com` | **500** |
| *(no Origin header)* | **200** ✅ |

`OPTIONS` preflights on `/auth/login` and `/t/{token}` likewise return **500** with **zero**
`Access-Control-*` headers.

### 4.2 Root cause

`src/config/cors.config.ts` in the backend (inspected **read-only**, not modified) rejects with a
thrown error rather than a clean deny:

```ts
if (origins.includes(origin)) { callback(null, true); }
else { callback(new Error('Not allowed by CORS')); }   // ← Nest surfaces this as a 500
```

The production allow-list is `https://splitcore.app`, `https://www.splitcore.app`, plus anything in
the **`ALLOWED_ORIGINS`** environment variable (comma-separated). `localhost:3000` 500s in production
because production quite correctly doesn't allow it — the bug is only that a denial is served as a
500 instead of a CORS rejection.

### 4.3 The fix — operational, no backend code change required

**CORS is already environment-variable driven**, so this is Section 6 case 1: a Render dashboard
change, *not* a source edit. **No backend file was modified by this work.**

> **Action required by a human, in the Render dashboard** → service `splitcore-api` → Environment:
>
> | Key | Value |
> |---|---|
> | `ALLOWED_ORIGINS` | `https://splitcore-app.netlify.app,https://<custom-domain-when-added>` |
>
> Comma-separated, no spaces, no trailing slashes. Include every Netlify domain that must reach the
> API from a browser. Redeploy/restart for it to take effect.
>
> Netlify **deploy-preview** URLs are per-deploy (`https://<hash>--splitcore-frontend.netlify.app`)
> and cannot be enumerated in a static list — previews will not be able to call the API from the
> browser. This does not affect this frontend (see §4.4).

Separately, worth filing as a backend bug (**not fixed here, per the isolation rule**): a disallowed
origin should produce a clean CORS denial, not a 500 `InternalServerError`. The current behaviour
makes every browser integration failure look like a server outage.

### 4.4 Why this does not block the frontend

**Server-side `fetch` from Next.js does not send an `Origin` header** — which is precisely the case
the backend explicitly allows (`if (!origin) return callback(null, true)`). This frontend therefore
routes **every** backend call through its own server (React Server Components and Route Handlers),
never browser→API directly. Consequences:

1. The app works end-to-end **today**, before anyone touches Render.
2. The JWT lives in an httpOnly cookie the browser can never read (§9 decision).
3. The backend base URL is never exposed to the client bundle.

Setting `ALLOWED_ORIGINS` is still recommended so that future direct-from-browser integrations and
debugging tools work.

---

## 5. Reproducing this audit

```bash
BASE=https://splitcore-api.onrender.com
curl -s $BASE/health | jq .
curl -s $BASE/api/docs-json -o /tmp/splitcore-openapi.json
jq -r '.paths | to_entries[] | .key as $p | .value | to_entries[] | "\(.key|ascii_upcase) \($p)"' /tmp/splitcore-openapi.json
curl -s $BASE/health -H "Origin: https://splitcore-app.netlify.app" -i | head -1
curl -s -o /dev/null -w '%{http_code}\n' $BASE/t/bogustoken123     # expect 404
curl -s -o /dev/null -w '%{http_code}\n' $BASE/venues              # expect 401
```

---

## 6. What each frontend route depends on

| Route | Depends on | Status |
|---|---|---|
| `/t/[token]` | `GET /t/{publicToken}` | ✅ real |
| `/t/[token]` → Continue | `POST /payments/initialize` | ✅ real |
| `/t/[token]/status` | `GET /payments/{reference}/status` | ✅ real |
| `/login` | `POST /auth/login` | ✅ real (response shape parsed defensively) |
| `/dashboard` money tiles | *(none exists)* | ⛔ "Not yet available" |
| `/dashboard` entertainer count | `GET /entertainers` | ✅ real |
| `/dashboard/transactions` | *(none exists)* | ⛔ "Coming soon" |
| `/dashboard/payouts` | *(none exists)* | ⛔ "Coming soon" |
| `/dashboard/entertainers` | `GET/POST/PATCH/DELETE /entertainers` (+ link/unlink) | ✅ real |
| `/dashboard/qr-codes` | `GET/POST/DELETE /qr-codes`, `POST /qr-codes/{id}/regenerate` | ✅ real |
| `/dashboard/split-rules` | `GET /split-rules/venue/{id}`, `/active`, `POST /split-rules` | ✅ real |
| `/dashboard/venues` | `GET/PATCH/DELETE /venues`, `GET /venues/{id}` | ✅ real |

---

## 7. Paystack callback — where the guest lands after paying

The frontend does **not** control Paystack's `callback_url`. The backend sets it when it
initializes the transaction, from its own **`PAYMENT_CALLBACK_URL`** environment variable, and
appends `?reference=<our externalReference>` to it. If the variable is unset or not a valid URL,
the backend omits `callbackUrl` entirely and Paystack falls back to its own default redirect.

**Consequence:** until `PAYMENT_CALLBACK_URL` points at this frontend, a guest completes payment
successfully but never sees the confirmation screen. The payment still happens and is still
recorded — only the confirmation is lost.

> **Second action required by a human, in the Render dashboard** → service `splitcore-api` →
> Environment:
>
> | Key | Value |
> |---|---|
> | `PAYMENT_CALLBACK_URL` | `https://<frontend-domain>/pay/confirming` |
>
> The frontend route reads `reference` from the query string, and falls back to a short-lived
> httpOnly cookie set at payment initialization if the query string is lost.

Together with §4.3, the **complete** set of backend environment changes this frontend needs:

| Key | Value | Why |
|---|---|---|
| `ALLOWED_ORIGINS` | `https://<frontend-domain>` | Recommended. Not strictly required — see §4.4. |
| `PAYMENT_CALLBACK_URL` | `https://<frontend-domain>/pay/confirming` | **Required** for guests to see the confirmation screen. |

No backend source file was modified.

---

## 8. Open questions for the next session

1. **`POST /auth/login`'s 200 response shape is still unverified** (§3.1). It needs one real set of
   venue-admin credentials to observe. Until then `lib/api/auth.ts` parses defensively.
2. **410 Gone was never triggered live** — it is declared in the OpenAPI document and handled
   distinctly in the UI, but confirming it needs a known-deactivated token.
3. **No end-to-end payment has been run** through real Paystack checkout, because that needs a real
   QR token from an authenticated venue with an active split rule.
4. **Per-venue tip min/max does not exist.** The guest screen uses the backend's own documented
   `InitializePaymentDto` bounds (₦100 – ₦10,000,000) rather than inventing venue-specific limits.
   If venues should be able to set their own, that is new backend work.
5. **Spectacle mode** has no supporting flag or endpoint, so the "Your tip is now showing on the
   venue screen" line is not rendered. Building it would mean faking it.

---
---

# Re-audit — 2026-09-26

Run before starting the v2 design work. **The deployed OpenAPI document is byte-identical to the
round-1 snapshot**, so the endpoint surface has not changed. Three things around it have.

```bash
diff <(jq -S . docs/splitcore-openapi.snapshot.json) <(curl -s .../api/docs-json | jq -S .)
# (no output — identical)
```

## A. CORS is fixed ✅

The round-1 blocker (§4) is gone. Verified live:

| Origin | Status | `Access-Control-Allow-Origin` |
|---|---|---|
| `https://splitcore-app.netlify.app` | 200 | `https://splitcore-app.netlify.app` ✅ |
| `http://localhost:3000` | 200 | *(none — correctly not allowed in production)* |
| `https://evil.example.com` | 200 | *(none — cleanly denied)* |

A disallowed origin now gets a clean denial instead of the previous **500**. The frontend still
proxies every call server-side — that remains the right design for keeping the JWT httpOnly and the
API URL out of the bundle — but browser calls are no longer categorically impossible.

## B. `POST /auth/login`'s response shape — CONFIRMED, was the last guess in the codebase

```jsonc
{ "accessToken": "<jwt>" }
```

**That is the whole body.** There is no `user` object, despite the OpenAPI description saying
"Returns JWT access token and user details". Everything about the caller lives in the JWT's claims:

```jsonc
{ "sub": "<user id>", "email": "...", "role": "PLATFORM_ADMIN" | "VENUE_ADMIN" }
```

`role` is the backend's Prisma `Role` enum, and those two values are the complete set. There is no
`venueId` claim — venue scoping is applied server-side, so `GET /venues` already returns only what
the caller may see.

`lib/api/auth.ts` is tightened to this and now types `role` as a closed union. The claims are read
for display and navigation only; the backend re-authorises every call, so a forged claim yields a
403, not access.

## C. Paystack now returns the guest to the tipping page

The payments service builds its callback as:

```
{FRONTEND_URL}/t/{publicToken}?reference={ourReference}
```

`FRONTEND_URL` takes precedence over the older `PAYMENT_CALLBACK_URL` (which, per the backend's own
comment, has pointed at the API's own host before). Paystack then appends its own `reference` and
`trxref`, so a **repeated query parameter is expected** — ours is appended first, so the first value
is the one the status endpoint knows.

`/t/[token]` now handles `?reference=`. `/pay/confirming` is kept working for a deployment still on
the old setting: a guest who has already paid must never land on a 404.

> **Render env var required:** `FRONTEND_URL` = `https://splitcore-app.netlify.app`

## D. Split-rule governance has NOT shipped

`CreateSplitRuleDto` still requires **all three** shares from the client:

```jsonc
{ "venueId": string, "entertainerBps": number, "venueBps": number, "platformBps": number }
```

`SplitRuleResponseDto` has **no status field** — a rule is active when `effectiveTo` is null, and
creating one takes effect immediately. There is no approval state, no approval token, and no
`/split-rules/respond` endpoint.

What was built against this reality:

- Platform fee is **locked in the UI** for venue admins and submitted as a hidden field carried
  forward from the venue's active rule. When the backend computes it server-side, deleting that
  hidden input is the entire change.
- Venue and entertainer shares are a **linked pair** that always total the remainder, so an invalid
  split can't be typed.
- Status badges show the **real** states (Active / Closed). **No "Pending entertainer approval"
  badge was built**, because nothing produces that state — a badge that never appears is worse than
  none.
- `/split-rules/respond/[token]` was **not built**. No endpoint backs it.
- The page states plainly that approval isn't live and that a saved split takes effect immediately.

## E. Swagger UI is live ✅

`https://splitcore-api.onrender.com/api/docs` renders a real Swagger UI (`<title>Splitcore API
Docs</title>`). Linked from the README.

## F. Still open

1. **No credentials have been supplied yet.** The `PLATFORM_ADMIN` vs `VENUE_ADMIN` split is
   implemented against the confirmed claim, but **has not been exercised with two real logins**.
2. **No end-to-end payment** has been run through live Paystack — still needs a real QR token from a
   venue with an active split rule.
3. **410 Gone** remains untriggered live; handled distinctly but unconfirmed.
4. The **guest tipping screen has not been visually verified** — rendering `TipFlow` needs a valid
   token, and this session has no browser automation. Structure, copy, tokens and the absence of any
   gradient are verified from the rendered HTML.

---
---

# Re-audit — 2026-09-26 (second pass, with credentials)

## A. Roles verified with real logins ✅

`POST /auth/login` returns exactly `{ accessToken }`. Role comes from the JWT claims.

| Account | `role` claim | `GET /venues` returns |
|---|---|---|
| `admin@splitcore.dev` | `PLATFORM_ADMIN` | **3 venues** — Eko Hotel & Suites, Cubana Chief Priest Club, Quilox Nightclub |
| `admin@quilox.com` | `VENUE_ADMIN` | **1 venue** — Quilox Nightclub |
| `admin@cubana.com` | `VENUE_ADMIN` | **1 venue** — Cubana Chief Priest Club |

Venue scoping is enforced server-side, so `GET /venues` is already the right data for each
caller. Confirmed end-to-end through the dashboard: the platform admin sees the "All venues"
nav item and the cross-venue page; a venue admin gets a 307 away from it.

> Repeated logins hit `@AuthRateLimit()`. If a login returns an empty body, wait rather than retry.

## B. ⚠️ Split-rule governance is NOT deployed

The deployed OpenAPI document is **byte-identical** to the round-1 snapshot, and:

```bash
curl -s .../platform/settings -H "Authorization: Bearer $PLATFORM_ADMIN_JWT"
# 404 {"statusCode":404,"message":"Cannot GET /platform/settings"}
```

The governance work exists as commit `3b28fad feat(split-rules): fix the platform fee and
require entertainer consent`, but the backend repo is **4 commits ahead of `origin/main` and
has never been pushed**. `origin/main` is `a8162b5` (the CORS fix), which is what Render is
serving. The same is true of `b62d2c7` (the Paystack callback change) — which is why
`/pay/confirming` is still doing real work.

> **To make governance live:** push the backend (`git push origin main`) and let Render redeploy.
> The frontend needs no change — it detects the new API at runtime (§C).

## C. The governance contract, and how the frontend handles both versions

`GET /platform/settings` is the **capability probe**. One call decides the whole page, rather
than six surfaces each guessing:

- **200** → governance API. Propose/approve flow, server-set platform fee, real status badges.
- **404** → legacy API. All three shares are client input, rules take effect immediately, and
  the page says so plainly instead of implying otherwise.

### Endpoints (read from the backend's committed DTOs)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/platform/settings` | any role | `{ platformFeeBps, splittableBps, updatedAt }` |
| PATCH | `/platform/settings` | `PLATFORM_ADMIN` | `{ platformFeeBps }` (0–9000). Rules in force keep their agreed fee |
| POST | `/split-rules` | venue/platform | **Proposes.** `{ venueId, entertainerId, entertainerBps, venueBps }` — **sending `platformBps` is a 400** |
| POST | `/split-rules/override` | `PLATFORM_ADMIN` | All three shares + `reason` (≥10 chars). Immediate, stamped `ADMIN_OVERRIDE` |
| GET | `/split-rules/{id}/respond/{token}` | **public** | Proposed terms + a worked example |
| POST | `/split-rules/{id}/respond/{token}` | **public** | `{ decision: "ACCEPT" \| "REJECT" }`. 404 invalid, 409 already answered |
| GET | `/split-rules/venue/{venueId}` | venue/platform | Full history, newest first |
| GET | `/split-rules/venue/{venueId}/active` | venue/platform | **Only ever ACTIVE.** 404 = no agreed rule = tips refused |
| GET | `/split-rules/{id}/audit` | venue/platform | Append-only trail |

`SplitRuleStatus` = `PENDING_ENTERTAINER_APPROVAL | ACTIVE | REJECTED | SUPERSEDED`.
`SplitRuleOrigin` = `VENUE_PROPOSAL | ADMIN_OVERRIDE`.
`effectiveFrom` is **null** while a proposal is unanswered.

### The consent URL

The backend builds it as `{FRONTEND_URL}/split-rules/{id}/respond/{token}` — note the rule id
is **in the path**, so the frontend route is `/split-rules/[id]/respond/[token]`, not
`/split-rules/respond/[token]`. It is returned **once** on the proposal response and is never
retrievable again; there is no notification channel, so the dashboard is the delivery
mechanism. The UI treats losing that panel as a real failure and offers a copy button.

## D. What was verified, and how

Governance can't run against the deployed backend, so the frontend's governance paths were
exercised against a **contract mock** built from the backend's own committed DTOs (test
harness, in scratch, not in this repo):

- ✅ Propose form: entertainer picker, locked platform fee, linked venue/entertainer pair
- ✅ "Awaiting entertainer approval" table renders separately from history
- ✅ All four status badges, including **`Active · forced`** for `ACTIVE + ADMIN_OVERRIDE` —
  the one badge that distinguishes "an entertainer agreed" from "nobody did"
- ✅ Platform-fee editor and override form appear for `PLATFORM_ADMIN` and are **absent** for
  `VENUE_ADMIN`
- ✅ Consent page renders terms, percentages and the backend's worked example; **200 with no
  cookie** (genuinely public); a wrong token shows "This approval link isn't valid."
- ✅ `proposeSplitRule` never sends `platformBps`

Against the **real deployed API**, with real credentials: both roles, venue scoping, the
cross-venue page, real entertainer counts, and the legacy split-rule path.

## E. Still open

1. **No end-to-end payment** through live Paystack — needs a real QR token for a venue with an
   active split rule.
2. **410 Gone** on `/t/{token}` still untriggered live.
3. **The guest tipping screen has not been visually reviewed** — this session has no browser
   automation. Structure, copy, tokens and zero gradients are verified from rendered HTML.
4. **Governance is unverified against the real backend** because it isn't deployed. It is
   verified against the contract; those are different things.

---
---

# Re-audit — 2026-09-26 (third pass)

Run to check whether the Phase 6/7 backend (entertainer portal, dashboard aggregates) had
shipped. It had not — but the check surfaced a production outage instead.

## A. 🚨 Tipping is down in production

```bash
curl -s .../t/ffb6a15bb6469ff3d421947125c87a2f          # 200 — QR resolves fine
curl -s -X POST .../payments/initialize \
  -d '{"sessionId":"…","amountKobo":10000}'             # 500 InternalServerError
```

**No guest can tip.** The QR code resolves, the tipping screen renders, and the payment fails.

### Cause

Split-rule governance **code** is deployed — the live OpenAPI now carries `/platform/settings`,
`/split-rules/override`, `/split-rules/{id}/respond/{token}` and `/split-rules/{id}/audit`, and
`CreateSplitRuleDto` is the governed four-field shape. The **database migration is not applied**:

```bash
GET /platform/settings                  → 500
GET /split-rules/venue/{id}             → 500
GET /split-rules/venue/{id}/active      → 500
POST /payments/initialize               → 500   (it needs the active rule)
```

`prisma/migrations/20260926120000_split_rule_governance` is committed and pushed, but Render
never runs it:

```yaml
buildCommand: npm ci --include=dev && npx prisma generate && npm run build
startCommand: npm run start:prod        # = node dist/main
```

`prisma generate` builds the client; it does not touch the database. Nothing in either command
runs `prisma migrate deploy`, so the new columns and the `platform_settings` table don't exist
and every split-rule query throws.

### Fix (backend / ops, not this repo)

Apply the migration against the production database:

```bash
npx prisma migrate deploy        # against DATABASE_URL for the Render Postgres
```

Then add it to the deploy so this can't recur — a Render **pre-deploy command**, or fold it into
the start command. Note the migration makes `split_rules.effective_from` nullable and adds
`status`/`origin` with defaults, so existing rows survive it.

## B. Phase 6/7 has not shipped

Every candidate endpoint returns 404 against the live API, probed with a `PLATFORM_ADMIN` token:

`/venues/{id}/overview` · `/venues/{id}/dashboard` · `/venues/{id}/stats` ·
`/venues/{id}/transactions` · `/venues/{id}/payouts` · `/entertainers/{id}/overview` ·
`/entertainers/{id}/dashboard` · `/entertainers/{id}/transactions` · `/entertainers/{id}/payouts` ·
`/entertainers/{id}/kyc` · `/kyc/status` · `/banks` · `/banks/resolve` · `/payouts` ·
`/transactions` · `/auth/entertainer/request-link` · `/entertainer/me`

The work exists locally as `0858f7c feat: entertainer KYC onboarding, entertainer access, and
dashboard aggregates`, but the backend repo is **3 commits ahead of `origin/main` and unpushed**
— the same thing that happened with governance last round.

**No entertainer portal or dashboard-aggregate UI was built**, per the instruction to stop rather
than build against endpoints that don't exist. Venue money tiles stay "Not yet available",
truthfully.

## C. Two frontend defects this exposed, both fixed

### 1. The capability probe treated "broken" as "old"

`getPlatformSettings` returned `PlatformSettings | null`, and the page wrapped it in
`.catch(() => null)`. A 500 therefore looked identical to a 404, so the dashboard silently
rendered the **legacy** split form — which submits `platformBps`, which the governance API
rejects with 400. A venue operator got a form that could only fail, with nothing saying why.

Now a three-way probe — `available` / `absent` / `broken` — and the failure is no longer
swallowed. A broken API shows one accurate error, names the likely cause, and renders **no
form**, because neither form could succeed.

It also stopped claiming "this venue has no agreed split, so it can't accept tips" when the
truth was that the active rule could not be *read*. Verified against the live 500.

### 2. Guests saw the backend's own error string

A 5xx from `/payments/initialize` fell through to `error.message`, putting **"An unexpected
error occurred"** in front of someone standing in a club. True, and useless. A server fault now
reads: *"Tips aren't going through right now. Please let the venue know — this is on us, not
you."* and is marked non-retryable, because retrying will not help.

## D. Still open

1. **Apply the migration** (§A) — tipping stays down until then.
2. **Push the backend** (§B) — Phase 6/7 is written but not deployed.
3. **Governance remains unverified against a healthy backend.** It is verified against the
   contract; it has never once run against a working database.
4. No end-to-end payment through live Paystack; 410 Gone still untriggered; the guest tipping
   screen still unreviewed visually.

---
---

# Re-audit — 2026-09-26 (fourth pass) — Phase 6/7 shipped ✅

## A. The outage from the third pass is over

The governance migration has been applied. Everything that was 500-ing now answers:

| Endpoint | Was | Now |
|---|---|---|
| `GET /platform/settings` | 500 | **200** `{platformFeeBps: 500, splittableBps: 9500}` |
| `GET /split-rules/venue/{id}` · `/active` | 500 | **200** |
| `GET /entertainers` · `GET /qr-codes` | 500 | **200** |
| `POST /payments/initialize` | 500 | **200** — real Paystack `authorizationUrl` |

**Guests can tip again.** The split-rules dashboard switched itself from the "broken" state
into full governance mode with no code change, which is what the capability probe was for.

## B. Phase 6/7 endpoints — all live, all verified

### Dashboard aggregates

| Endpoint | Shape | Verified |
|---|---|---|
| `GET /venues/{id}/overview` | `{venueId, venueName, windowFrom, windowTo, totalTipsKobo, transactionCount, entertainerCount, pendingPayoutsKobo}` | ✅ real data |
| `GET /venues/{id}/entertainer-earnings` | `[{entertainerId, stageName, tonightKobo, thisWeekKobo, totalKobo}]` | ✅ |
| `GET /venues/{id}/transactions` | `{total, limit, offset, items[]}` | ✅ |
| `GET /venues/{id}/payouts` | `{total, limit, offset, items[]}` | ✅ |
| `GET /entertainers/{id}/overview` | `{…tonightKobo, thisWeekKobo, totalKobo, pendingPayoutsKobo, paidOutKobo}` | ✅ |
| `GET /entertainers/{id}/transactions` · `/payouts` | same paginated envelope | ✅ |

The window is **midnight Africa/Lagos to now**, defined by the backend. Entertainer figures are
**their own share**, summed from ledger credits — not gross tips.

> ⚠️ `limit` and `offset` are documented as optional, but omitting them makes the backend's
> `ParseIntPipe` answer **400 "Validation failed (numeric string is expected)"**. The client
> always sends both explicitly. Worth fixing backend-side; harmless here.

> The paginated envelope has **no declared schema** in the OpenAPI document. The types mirror the
> live response observed on 2026-09-26.

### Entertainer access — a token link, not a password

| Endpoint | Notes |
|---|---|
| `POST /entertainer-auth/login-links/{entertainerId}` | Venue/platform admin issues it. 30-minute expiry, **single use**, and issuing a new one invalidates any outstanding link. Returns `{loginUrl, token, expiresAt}` |
| `POST /entertainer-auth/sessions` | **Public.** `{token}` → `{accessToken, entertainerId, stageName}`. JWT is `ENTERTAINER`-scoped, read-only, 12 hours |

`loginUrl` is `{FRONTEND_URL}/entertainer/login/{token}` — hence that exact frontend route.

Verified live end to end: issued a link, redeemed it (claims `role: "ENTERTAINER"`), then
**replayed the same token and got 401** — single use confirmed.

### KYC onboarding

Every step answers the same `KycStatusResponseDto`, carrying a server-derived `nextStep`
(`BANK_DETAILS → RESOLVE_ACCOUNT → CONFIRM_ACCOUNT → VERIFY_IDENTITY → DONE`). **The client never
works out where someone is in the flow** — it renders whatever `nextStep` says.

| Endpoint | Step |
|---|---|
| `POST /entertainers/{id}/kyc/bank-details` | 1. `{bankName, bankCode, accountNumber}`. Changing the account clears every later check |
| `POST /entertainers/{id}/kyc/resolve-account` | 2. Asks the bank who owns it. Rejection → 400 and KYC `FAILED` |
| `POST /entertainers/{id}/kyc/confirm-account` | 3. `{confirmedAccountName}` must match what the bank returned |
| `POST /entertainers/{id}/kyc/verify-identity` | 4. `{documentType: BVN\|NIN, documentNumber}` — number never stored, logged or returned |
| `POST /entertainers/{id}/kyc/review` | `PLATFORM_ADMIN` only. The exit from `REVIEW` |
| `GET /entertainers/{id}/kyc/status` | Current state. Account number masked to last four |

**Identity verification is gated.** Per the backend's own description, every entertainer lands in
`REVIEW` while identity checks are unavailable on the connected Paystack account (it gates those
APIs behind the CAC-registered "Registered Business" tier). The portal surfaces the backend's
`failureReason` verbatim rather than spinning forever.

### ⚠️ Gap: there is no bank-list endpoint

`SubmitBankDetailsDto.bankCode` says it should be *"fetched from the provider's bank list, not
guessed from the name"* — **but no such endpoint exists**. There is no `GET /banks`.

The portal therefore asks the entertainer to type the code, with help text saying their venue can
look it up. **No bank list is hardcoded**: codes change, and a wrong one sends someone's money to
the wrong bank. A `GET /banks` proxy is the right fix and is backend work.

## C. What was verified, against the live API

- **Venue dashboard money tiles**: Total Tips ₦10,000 · Transactions 2 · Entertainers 1 ·
  Pending Payouts ₦9,500 — each matching the raw endpoint response.
- **Venue transactions and payouts**: real references, real statuses, pagination.
- **Entertainer portal**: signed in with a genuinely redeemed link and rendered the real
  dashboard — tiles, two real tips, an honestly empty payouts list, and KYC showing `VERIFIED` /
  `DONE` with `GTBank ******6789`.
- **Entertainers roster**: real KYC badges across three states (`Verified`, `Manual review`,
  `Not started`) and a working sign-in-link action.
- **Split rules**: now renders "Propose a split" — governance mode, reached with no code change.

## D. Still open

1. **`GET /banks`** — see the gap above.
2. **`limit`/`offset` should genuinely be optional** on the four paginated endpoints.
3. Deploys still don't run migrations. `prisma migrate deploy` belongs in a Render pre-deploy
   command, or this recurs on the next schema change.
4. No end-to-end payment completed through Paystack checkout; 410 Gone still untriggered; the
   guest tipping screen still not visually reviewed.
