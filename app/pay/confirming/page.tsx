import type { Metadata } from "next";
import { cookies } from "next/headers";

import { PaymentStatusView } from "@/components/PaymentStatus";

import { GuestShell } from "../../t/[token]/GuestShell";

/**
 * Legacy return route.
 *
 * The deployed backend now returns guests to `/t/{publicToken}?reference=…`
 * instead (see that page). This route stays because a backend still running the
 * older PAYMENT_CALLBACK_URL setting sends guests here, and a guest who has
 * already paid must never land on a 404.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Confirming payment" };

export default async function ConfirmingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const store = await cookies();
  const reference =
    first(query.reference) ??
    first(query.trxref) ??
    store.get("splitcore_last_reference")?.value ??
    null;

  const lastToken = store.get("splitcore_last_token")?.value;

  return (
    <GuestShell>
      <PaymentStatusView
        reference={reference}
        retryHref={lastToken ? `/t/${encodeURIComponent(lastToken)}` : null}
      />
    </GuestShell>
  );
}
