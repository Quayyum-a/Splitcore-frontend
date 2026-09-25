import type { Metadata } from "next";
import Link from "next/link";

import {
  Badge,
  Card,
  CardHeader,
  ErrorNotice,
  KycBadge,
  PageHeader,
  StatTile,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { listEntertainers, listQrCodes, listVenues } from "@/lib/api/dashboard";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Overview" };

/**
 * Venue overview.
 *
 * HONESTY RULE: the backend exposes no transactions, payouts, or aggregate
 * totals endpoint (docs/api-audit.md §2). Money tiles therefore say "Not yet
 * available" rather than deriving a plausible figure from partial data. A
 * dashboard that quietly shows a wrong number is worse than one that shows
 * none — the entire pitch to venues is numbers they can trust.
 *
 * The counts below are real: they are the length of lists the API actually
 * returned.
 */
export default async function OverviewPage() {
  const { token } = await requireSession();

  const [venues, entertainers, qrCodes] = await Promise.all([
    listVenues(token).catch(() => null),
    listEntertainers(token).catch(() => null),
    listQrCodes(token).catch(() => null),
  ]);

  const activeEntertainers = entertainers?.filter((e) => e.isActive) ?? null;
  const activeQrCodes = qrCodes?.filter((q) => q.isActive) ?? null;
  const unreachable = venues === null && entertainers === null && qrCodes === null;

  return (
    <>
      <PageHeader
        title="Tonight"
        description="Live counts come straight from the API. Money figures are held back until the backend exposes them."
      />

      {unreachable ? (
        <div className="mb-6">
          <ErrorNotice message="Couldn't reach the Splitcore API. It may be waking up from cold start — reload in a moment." />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total Tips"
          unavailable="No aggregate-totals endpoint exists on the backend yet."
        />
        <StatTile
          label="Transactions"
          unavailable="No transactions endpoint exists on the backend yet."
        />
        <StatTile
          label="Entertainers"
          value={activeEntertainers ? String(activeEntertainers.length) : "—"}
          hint={
            entertainers
              ? `${entertainers.length} total · ${activeEntertainers?.length ?? 0} active`
              : "Could not load"
          }
        />
        <StatTile
          label="Pending Payouts"
          unavailable="No payouts endpoint exists on the backend yet."
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Venues"
          value={venues ? String(venues.length) : "—"}
          hint={venues ? `${venues.filter((v) => v.isActive).length} active` : "Could not load"}
        />
        <StatTile
          label="Active QR codes"
          value={activeQrCodes ? String(activeQrCodes.length) : "—"}
          hint={qrCodes ? `${qrCodes.length} generated in total` : "Could not load"}
        />
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader
            title="Entertainers"
            description="Per-entertainer tonight / this week / total figures need the aggregates endpoint that doesn't exist yet."
          />
          {entertainers && entertainers.length > 0 ? (
            <Table
              head={
                <tr>
                  <Th>Stage name</Th>
                  <Th>KYC</Th>
                  <Th>Status</Th>
                  <Th>Venues</Th>
                  <Th>Tonight</Th>
                </tr>
              }
            >
              {entertainers.slice(0, 8).map((entertainer) => (
                <tr key={entertainer.id}>
                  <Td className="font-medium text-slate-900">{entertainer.stageName}</Td>
                  <Td>
                    <KycBadge status={entertainer.kycStatus} />
                  </Td>
                  <Td>
                    <Badge tone={entertainer.isActive ? "positive" : "neutral"}>
                      {entertainer.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </Td>
                  <Td className="tabular-nums">{entertainer.venueIds.length}</Td>
                  <Td className="text-slate-400">Not yet available</Td>
                </tr>
              ))}
            </Table>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              {entertainers ? (
                <>
                  No entertainers yet.{" "}
                  <Link href="/dashboard/entertainers" className="font-medium text-slate-900 underline">
                    Add one
                  </Link>
                  .
                </>
              ) : (
                "Could not load entertainers."
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
