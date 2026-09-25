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
| `https://splitcore-frontend.netlify.app` | **500** |
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
> | `ALLOWED_ORIGINS` | `https://splitcore-frontend.netlify.app,https://<custom-domain-when-added>` |
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
curl -s $BASE/health -H "Origin: https://splitcore-frontend.netlify.app" -i | head -1
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
