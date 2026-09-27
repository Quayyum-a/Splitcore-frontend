import type { Metadata } from "next";

import {
  Badge,
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Table,
  Td,
  Th,
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
import { formatNaira } from "@/lib/money";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payouts" };

const LIMIT = 25;

/** What each entertainer is owed and what has been sent. */
export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string; offset?: string }>;
}) {
  const { token } = await requireSession();
  const { venue: venueParam, offset: offsetParam } = await searchParams;
  const offset = Math.max(0, Number(offsetParam) || 0);

  const venues = await listVenues(token).catch(() => null);
  const selectedVenue = venues?.find((v) => v.id === venueParam) ?? venues?.[0] ?? null;

  if (venues === null) {
    return (
      <>
        <PageHeader title="Payouts" />
        <ErrorNotice message="Couldn't reach the Splitcore API. Reload in a moment." />
      </>
    );
  }
  if (!selectedVenue) {
    return (
      <>
        <PageHeader title="Payouts" />
        <Card>
          <EmptyState title="No venues on this account" detail="Nothing to show yet." />
        </Card>
      </>
    );
  }

  const page = await getVenuePayouts(token, selectedVenue.id, { limit: LIMIT, offset });

  return (
    <>
      <PageHeader
        title="Payouts"
        description="What each entertainer is owed, what's been sent, and when."
      />
      <VenuePicker venues={venues} selectedId={selectedVenue.id} basePath="/dashboard/payouts" />

      <Card>
        {page === null ? (
          <div className="p-5">
            <ErrorNotice message="Payouts couldn't be loaded. Reload in a moment — this is not the same as there being none." />
          </div>
        ) : page.items.length === 0 ? (
          <EmptyState
            title="No payouts yet"
            detail="Payouts appear here once tips have been split and queued."
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
              {page.items.map((row) => (
                <tr key={row.id}>
                  <Td className="font-medium text-slate-900">
                    {row.entertainerName ?? <span className="font-normal text-slate-400">Unassigned</span>}
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
              venueId={selectedVenue.id}
              offset={page.offset}
              limit={page.limit}
              total={page.total}
            />
          </>
        )}
      </Card>
    </>
  );
}
