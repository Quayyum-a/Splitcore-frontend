import type { Metadata } from "next";

import {
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  PageHeader,
  PayoutAccountBadge,
  payoutAccountState,
} from "@/components/admin/ui";
import { VenuePicker } from "@/components/admin/VenuePicker";
import { getBanks } from "@/lib/api/banks";
import { listVenues } from "@/lib/api/dashboard";
import { getVenuePayoutAccount } from "@/lib/api/venue-payout-account";
import { requireSession } from "@/lib/session";

import { PayoutAccountFlow } from "./PayoutAccountFlow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payout account" };

/**
 * Where a venue sets up the account its own share of tips is paid into.
 *
 * Reachable by a VENUE_ADMIN for their own venue and a PLATFORM_ADMIN for any:
 * `GET /venues` is already role-filtered, and the backend answers 403 for a
 * venue the caller has no business touching, so the picker below can only ever
 * offer venues they legitimately see.
 */
export default async function PayoutAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string }>;
}) {
  const { token } = await requireSession();
  const { venue: venueParam } = await searchParams;

  const venues = await listVenues(token).catch(() => null);

  if (venues === null) {
    return (
      <>
        <PageHeader title="Payout account" />
        <ErrorNotice message="Couldn't reach the Splitcore API. Reload in a moment." />
      </>
    );
  }
  if (venues.length === 0) {
    return (
      <>
        <PageHeader title="Payout account" />
        <Card>
          <EmptyState
            title="No venues on this account"
            detail="There's nothing to set up a payout account for yet."
          />
        </Card>
      </>
    );
  }

  const selectedVenue = venues.find((v) => v.id === venueParam) ?? venues[0];

  const [account, banks] = await Promise.all([
    getVenuePayoutAccount(token, selectedVenue.id).catch(() => null),
    getBanks(token),
  ]);

  const state = account ? payoutAccountState(account) : null;

  return (
    <>
      <PageHeader
        title="Payout account"
        description="Where this venue's share of every tip is paid. Separate from what entertainers are paid."
      />
      <VenuePicker
        venues={venues}
        selectedId={selectedVenue.id}
        basePath="/dashboard/payout-account"
      />

      {account === null ? (
        <ErrorNotice message="Couldn't load this venue's payout account. Reload in a moment — this is not the same as it not being set up." />
      ) : (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{account.venueName}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{state?.detail}</p>
            </div>
            <PayoutAccountBadge account={account} />
          </div>
          <PayoutAccountFlow account={account} banks={banks} />
        </Card>
      )}

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Why the bank check matters"
            description="The same discipline entertainers go through."
          />
          <p className="px-5 py-5 text-sm leading-relaxed text-slate-500">
            Splitcore asks the bank who owns the account and shows you its answer before
            anything is paid out. That is the step that makes a payout destination trusted
            rather than merely typed, so it is never skipped and never accepted on your
            behalf. Changing the account number later clears the check and you&rsquo;ll be
            asked to confirm again.
          </p>
        </Card>
      </div>
    </>
  );
}
