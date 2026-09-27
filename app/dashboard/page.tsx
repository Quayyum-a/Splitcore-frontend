import type { Metadata } from "next";
import Link from "next/link";

import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  KycBadge,
  PageHeader,
  StatTile,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { listEntertainers, listVenues } from "@/lib/api/dashboard";
import { getVenueEntertainerEarnings, getVenueOverview } from "@/lib/api/insights";
import { formatNaira } from "@/lib/money";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Overview" };

/**
 * Venue overview.
 *
 * Every money figure comes from GET /venues/{id}/overview, computed by the
 * backend over a window it defines (midnight Africa/Lagos to now). Nothing is
 * summed here. If that call fails the tiles say so rather than showing a zero —
 * on a money dashboard, "none tonight" and "we couldn't check" must not look
 * the same.
 */
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string }>;
}) {
  const { token } = await requireSession();
  const { venue: venueParam } = await searchParams;

  const venues = await listVenues(token).catch(() => null);
  const selectedVenue = venues?.find((v) => v.id === venueParam) ?? venues?.[0] ?? null;

  const [overview, earnings, entertainers] = await Promise.all([
    selectedVenue ? getVenueOverview(token, selectedVenue.id) : Promise.resolve(null),
    selectedVenue
      ? getVenueEntertainerEarnings(token, selectedVenue.id)
      : Promise.resolve(null),
    listEntertainers(token).catch(() => null),
  ]);

  if (venues === null) {
    return (
      <>
        <PageHeader title="Tonight" />
        <ErrorNotice message="Couldn't reach the Splitcore API. It may be waking up from a cold start — reload in a moment." />
      </>
    );
  }

  if (venues.length === 0) {
    return (
      <>
        <PageHeader title="Tonight" />
        <Card>
          <EmptyState
            title="No venues on this account"
            detail="There's nothing to report on yet."
          />
        </Card>
      </>
    );
  }

  const kycById = new Map((entertainers ?? []).map((e) => [e.id, e]));

  return (
    <>
      <PageHeader
        title="Tonight"
        description={
          overview
            ? `${overview.venueName} · since midnight (${formatTime(overview.windowFrom)})`
            : selectedVenue?.name
        }
      />

      {venues.length > 1 ? (
        <nav className="mb-6 flex flex-wrap gap-2">
          {venues.map((venue) => (
            <Link
              key={venue.id}
              href={`/dashboard?venue=${venue.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                venue.id === selectedVenue?.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {venue.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {overview === null ? (
        <div className="mb-6">
          <ErrorNotice message="Tonight's figures couldn't be loaded, so they're left blank rather than shown as zero. Reload in a moment." />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total Tips"
          value={overview ? formatNaira(overview.totalTipsKobo) : undefined}
          unavailable={overview ? undefined : "Couldn't be loaded just now."}
          hint={overview ? "Successful tips tonight" : undefined}
        />
        <StatTile
          label="Transactions"
          value={overview ? String(overview.transactionCount) : undefined}
          unavailable={overview ? undefined : "Couldn't be loaded just now."}
          hint={overview ? "Successful tonight" : undefined}
        />
        <StatTile
          label="Entertainers"
          value={overview ? String(overview.entertainerCount) : undefined}
          unavailable={overview ? undefined : "Couldn't be loaded just now."}
          hint={overview ? "Linked to this venue" : undefined}
        />
        <StatTile
          label="Pending Payouts"
          value={overview ? formatNaira(overview.pendingPayoutsKobo) : undefined}
          unavailable={overview ? undefined : "Couldn't be loaded just now."}
          hint={overview ? "Venue + entertainers, owed now" : undefined}
        />
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader
            title="Entertainers"
            description="Each entertainer's own share — tonight, this week, and all time."
          />
          {earnings === null ? (
            <div className="p-5">
              <ErrorNotice message="Per-entertainer earnings couldn't be loaded." />
            </div>
          ) : earnings.length === 0 ? (
            <EmptyState
              title="No entertainers linked to this venue"
              detail="Link one under Entertainers to start tracking their earnings."
            />
          ) : (
            <Table
              head={
                <tr>
                  <Th>Stage name</Th>
                  <Th>KYC</Th>
                  <Th>Tonight</Th>
                  <Th>This week</Th>
                  <Th>Total</Th>
                </tr>
              }
            >
              {earnings.map((row) => {
                const entertainer = kycById.get(row.entertainerId);
                return (
                  <tr key={row.entertainerId}>
                    <Td className="font-medium text-slate-900">{row.stageName}</Td>
                    <Td>
                      {entertainer ? (
                        <KycBadge status={entertainer.kycStatus} />
                      ) : (
                        <Badge tone="neutral">Unknown</Badge>
                      )}
                    </Td>
                    <Td className="tabular-nums">{formatNaira(row.tonightKobo)}</Td>
                    <Td className="tabular-nums">{formatNaira(row.thisWeekKobo)}</Td>
                    <Td className="tabular-nums">{formatNaira(row.totalKobo)}</Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-NG", {
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
}
