import type { Metadata } from "next";

import { PaymentStatusView } from "@/components/PaymentStatus";
import { resolveToken } from "@/lib/api/guest";

import { GuestShell } from "./GuestShell";
import { TipFlow } from "./TipFlow";

/**
 * The page a scanned QR code lands on — and, now, the page Paystack returns the
 * guest to.
 *
 * The backend builds its callback as `{FRONTEND_URL}/t/{publicToken}?reference=…`
 * (verified against the deployed payments service), so paying and coming back
 * are one continuous flow on a single route with no extra page to bounce
 * through. /pay/confirming is kept working as well, because an older
 * PAYMENT_CALLBACK_URL deployment points there instead.
 *
 * force-dynamic: a token's validity changes the moment a venue deactivates its
 * code. A cached "still valid" render would take tips for a dead code.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Send a tip" };

export default async function TipPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);

  // Paystack appends its own `reference` and `trxref` on top of ours, so a
  // repeated parameter is expected. Ours is appended first, so the first value
  // is the one the status endpoint knows.
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const reference = first(query.reference) ?? first(query.trxref) ?? null;

  if (reference) {
    return (
      <GuestShell>
        <PaymentStatusView
          reference={reference}
          retryHref={`/t/${encodeURIComponent(token)}`}
        />
      </GuestShell>
    );
  }

  const resolution = await resolveToken(token);

  if (resolution.kind === "not-found") {
    return (
      <GuestShell>
        <GuestMessage
          title="This tipping link isn't valid."
          detail="Double-check the code you scanned, or ask a member of staff."
        />
      </GuestShell>
    );
  }

  if (resolution.kind === "gone") {
    return (
      <GuestShell>
        <GuestMessage
          title="This tipping link is no longer active."
          detail="This code has been turned off. Ask a member of staff for a current one."
        />
      </GuestShell>
    );
  }

  if (resolution.kind === "error") {
    return (
      <GuestShell>
        <GuestMessage
          title="We couldn't load this tipping page."
          detail="Check your connection and try again in a moment."
          tone="warning"
        />
      </GuestShell>
    );
  }

  return (
    <GuestShell>
      <TipFlow token={token} resolution={resolution.data} />
    </GuestShell>
  );
}

function GuestMessage({
  title,
  detail,
  tone = "neutral",
}: {
  title: string;
  detail: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <section className="flex h-full flex-col items-center justify-center text-center">
      <span
        aria-hidden="true"
        className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full border ${
          tone === "warning" ? "border-gold/30 text-gold" : "border-ink-700 text-ink-400"
        }`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="1.1" fill="currentColor" />
        </svg>
      </span>
      <h1 className="text-xl font-semibold text-cream">{title}</h1>
      <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-ink-400">{detail}</p>
    </section>
  );
}
