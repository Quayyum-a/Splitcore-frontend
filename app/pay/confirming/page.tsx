import type { Metadata } from "next";
import { cookies } from "next/headers";

import { GuestShell } from "@/app/t/[token]/GuestShell";

import { PaymentStatusView } from "./PaymentStatusView";

/**
 * Where the guest lands after Paystack checkout.
 *
 * The backend builds Paystack's callback_url from its own PAYMENT_CALLBACK_URL
 * env var and appends `?reference=<our reference>` (verified in the backend's
 * payments service). Point that variable at this route:
 *
 *   PAYMENT_CALLBACK_URL = https://<frontend-domain>/pay/confirming
 *
 * See docs/api-audit.md §7. Until it is set, Paystack falls back to its own
 * default redirect and the guest never reaches this screen — the payment still
 * completes and is still recorded, they just don't see the confirmation.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Confirming payment" };

export default async function ConfirmingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;

  // Our own reference is appended first, so when Paystack adds its own
  // `reference`/`trxref` the first value is still ours.
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const store = await cookies();
  const fromQuery = first(query.reference) ?? first(query.trxref);
  const reference = fromQuery ?? store.get("splitcore_last_reference")?.value ?? null;

  // "Try Again" has to land back on the QR token the guest actually scanned.
  const lastToken = store.get("splitcore_last_token")?.value;
  const retryHref = lastToken ? `/t/${encodeURIComponent(lastToken)}` : null;

  return (
    <GuestShell>
      <PaymentStatusView reference={reference} retryHref={retryHref} />
    </GuestShell>
  );
}
