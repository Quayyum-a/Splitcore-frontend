import type { Metadata } from "next";
import Link from "next/link";

import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  PageHeader,
  PayoutAccountBadge,
  Table,
  Td,
  Th,
  payoutAccountState,
} from "@/components/admin/ui";
import {
  Pager,
  VenuePicker,
  formatLagos,
  payoutTone,
  titleCase,
} from "@/components/admin/VenuePicker";
import { listVenues } from "@/lib/api/dashboard";
import { getVenuePayouts } from "@/lib/api/insights";
import type { PayoutRow, Paginated, VenuePayoutAccount } from "@/lib/api/types";
import {
  getVenueOwnPayouts,
  getVenuePayoutAccount,
} from "@/lib/api/venue-payout-account";
import { formatNaira } from "@/lib/money";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payouts" };

const LIMIT = 10;

/**
 * Two pools of money, two destinations, two sections.
 *
 * The venue's own share and what its entertainers are owed come from separate
 * endpoints and are rendered separately and differently — never merged into one
 * table. "₦4,750 to DJ Neptune" and "₦4,750 to the venue" are the same number
 * to a glance and completely different to a reconciliation, and a venue
 * mistaking one for the other is exactly the failure this product exists to
 * prevent.
 */
export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string; own?: string; ent?: string }>;
}) {
  const { token } = await requireSession();
  const { venue: venueParam, own: ownParam, ent: entParam } = await searchParams;
  const ownOffset = Math.max(0, Number(ownParam) || 0);
  const entOffset = Math.max(0, Number(entParam) || 0);

  const venues = await listVenues(token).catch(() => null);

  if (venues === null) {
    return (
      <>
        <PageHeader title="Payouts" />
        <ErrorNotice message="Couldn't reach the Splitcore API. Reload in a moment." />
      </>
    );
  }
  if (venues.length === 0) {
    return (
      <>
        <PageHeader title="Payouts" />
        <Card>
          <EmptyState title="No venues on this account" detail="Nothing to show yet." />
        </Card>
      </>
    );
  }

  const selectedVenue = venues.find((v) => v.id === venueParam) ?? venues[0];

  const [account, ownPayouts, entertainerPayouts] = await Promise.all([
    getVenuePayoutAccount(token, selectedVenue.id).catch(() => null),
    getVenueOwnPayouts(token, selectedVenue.id, { limit: LIMIT, offset: ownOffset }).catch(
      () => null,
    ),
    getVenuePayouts(token, selectedVenue.id, { limit: LIMIT, offset: entOffset }),
  ]);

  return (
    <>
      <PageHeader
        title="Payouts"
        description="Your venue's own share and what your entertainers are owed. Two separate pools."
      />
      <VenuePicker venues={venues} selectedId={selectedVenue.id} basePath="/dashboard/payouts" />

      <VenueOwnSection
        venueId={selectedVenue.id}
        venueName={selectedVenue.name}
        account={account}
        payouts={ownPayouts}
        offset={ownOffset}
      />

      <EntertainerSection
        venueId={selectedVenue.id}
        payouts={entertainerPayouts}
        offset={entOffset}
      />
    </>
  );
}

/**
 * Deliberately styled apart from the entertainer table: a dark header band and
 * a heavier border, so the two can't be skim-read as one list.
 */
function VenueOwnSection({
  venueId,
  venueName,
  account,
  payouts,
  offset,
}: {
  venueId: string;
  venueName: string;
  account: VenuePayoutAccount | null;
  payouts: Paginated<PayoutRow> | null;
  offset: number;
}) {
  const state = account ? payoutAccountState(account) : null;
  const notSetUp = account?.nextStep !== "DONE";

  return (
    <section className="mb-8 overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Your venue&rsquo;s payout</h2>
          <p className="mt-0.5 text-xs text-slate-300">
            {venueName}&rsquo;s own share of tips. Paid to your venue&rsquo;s account.
          </p>
        </div>
        {account ? <PayoutAccountBadge account={account} /> : null}
      </div>

      {account === null ? (
        <div className="p-5">
          <ErrorNotice message="Couldn't load this venue's payout account. This is not the same as it not being set up." />
        </div>
      ) : notSetUp ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-800">
            Add your payout account to receive your share
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
            {state?.detail} Until it&rsquo;s confirmed, your share keeps accruing but
            nothing is sent.
          </p>
          <Link
            href={`/dashboard/payout-account?venue=${venueId}`}
            className="mt-5 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Set up payout account
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-slate-200 px-5 py-3 text-sm">
            <span className="text-slate-500">
              Paying to{" "}
              <span className="font-medium text-slate-900">{account.bankName}</span>{" "}
              <span className="tabular-nums text-slate-700">
                {account.accountNumberMasked}
              </span>
            </span>
            <Link
              href={`/dashboard/payout-account?venue=${venueId}`}
              className="text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              Change
            </Link>
          </div>

          {payouts === null ? (
            <div className="p-5">
              <ErrorNotice message="Your venue's payout history couldn't be loaded." />
            </div>
          ) : payouts.items.length === 0 ? (
            <EmptyState
              title="No payouts to your venue yet"
              detail="Your share appears here once tips have been split and queued."
            />
          ) : (
            <>
              <Table
                head={
                  <tr>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                    <Th>Reference</Th>
                    <Th>Time</Th>
                  </tr>
                }
              >
                {payouts.items.map((row) => (
                  <tr key={row.id}>
                    <Td className="tabular-nums font-medium text-slate-900">
                      {formatNaira(row.amountKobo)}
                    </Td>
                    <Td>
                      <Badge tone={payoutTone(row.status)}>{titleCase(row.status)}</Badge>
                      {row.failureReason ? (
                        <p className="mt-1 max-w-[18rem] text-xs leading-relaxed text-red-600">
                          {row.failureReason}
                        </p>
                      ) : null}
                    </Td>
                    <Td className="font-mono text-xs break-all text-slate-500">
                      {row.reference ?? <span className="font-sans text-slate-400">—</span>}
                    </Td>
                    <Td className="tabular-nums whitespace-nowrap">{formatLagos(row.time)}</Td>
                  </tr>
                ))}
              </Table>
              <Pager
                basePath="/dashboard/payouts"
                venueId={venueId}
                offset={payouts.offset}
                limit={payouts.limit}
                total={payouts.total}
                offsetParam="own"
              />
            </>
          )}
        </>
      )}
    </section>
  );
}

function EntertainerSection({
  venueId,
  payouts,
  offset,
}: {
  venueId: string;
  payouts: Paginated<PayoutRow> | null;
  offset: number;
}) {
  return (
    <Card>
      <CardHeader
        title="Entertainer payouts"
        description="What the entertainers who performed here are owed. A different pool of money, going to different accounts."
      />
      {payouts === null ? (
        <div className="p-5">
          <ErrorNotice message="Entertainer payouts couldn't be loaded. This is not the same as there being none." />
        </div>
      ) : payouts.items.length === 0 ? (
        <EmptyState
          title="No entertainer payouts yet"
          detail="These appear once tips have been split and queued to your entertainers."
        />
      ) : (
        <>
          <Table
            head={
              <tr>
                <Th>Entertainer</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th>Reference</Th>
                <Th>Time</Th>
              </tr>
            }
          >
            {payouts.items.map((row) => (
              <tr key={row.id}>
                <Td className="font-medium text-slate-900">
                  {row.entertainerName ?? (
                    <span className="font-normal text-slate-400">Unassigned</span>
                  )}
                </Td>
                <Td className="tabular-nums">{formatNaira(row.amountKobo)}</Td>
                <Td>
                  <Badge tone={payoutTone(row.status)}>{titleCase(row.status)}</Badge>
                  {row.failureReason ? (
                    <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-red-600">
                      {row.failureReason}
                    </p>
                  ) : null}
                </Td>
                <Td className="font-mono text-xs break-all text-slate-500">
                  {row.reference ?? <span className="font-sans text-slate-400">—</span>}
                </Td>
                <Td className="tabular-nums whitespace-nowrap">{formatLagos(row.time)}</Td>
              </tr>
            ))}
          </Table>
          <Pager
            basePath="/dashboard/payouts"
            venueId={venueId}
            offset={payouts.offset}
            limit={payouts.limit}
            total={payouts.total}
            offsetParam="ent"
          />
        </>
      )}
    </Card>
  );
}
