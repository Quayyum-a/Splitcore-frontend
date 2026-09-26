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
  paymentTone,
  titleCase,
} from "@/components/admin/VenuePicker";
import { listVenues } from "@/lib/api/dashboard";
import { getVenueTransactions } from "@/lib/api/insights";
import { formatNaira } from "@/lib/money";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Transactions" };

const LIMIT = 25;

/** Every tip at this venue, straight from GET /venues/{id}/transactions. */
export default async function TransactionsPage({
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
        <PageHeader title="Transactions" />
        <ErrorNotice message="Couldn't reach the Splitcore API. Reload in a moment." />
      </>
    );
  }
  if (!selectedVenue) {
    return (
      <>
        <PageHeader title="Transactions" />
        <Card>
          <EmptyState title="No venues on this account" detail="Nothing to show yet." />
        </Card>
      </>
    );
  }

  const page = await getVenueTransactions(token, selectedVenue.id, { limit: LIMIT, offset });

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every tip taken at this venue, newest first."
      />
      <VenuePicker venues={venues} selectedId={selectedVenue.id} basePath="/dashboard/transactions" />

      <Card>
        {page === null ? (
          <div className="p-5">
            <ErrorNotice message="Transactions couldn't be loaded. Reload in a moment — this is not the same as there being none." />
          </div>
        ) : page.items.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            detail="Tips will appear here as soon as guests start scanning."
          />
        ) : (
          <>
            <Table
              head={
                <tr>
                  <Th>Time</Th>
                  <Th>Amount</Th>
                  <Th>Entertainer</Th>
                  <Th>Guest</Th>
                  <Th>Status</Th>
                  <Th>Reference</Th>
                </tr>
              }
            >
              {page.items.map((row) => (
                <tr key={row.id}>
                  <Td className="tabular-nums whitespace-nowrap">{formatLagos(row.time)}</Td>
                  <Td className="tabular-nums font-medium text-slate-900">
                    {formatNaira(row.amountKobo)}
                  </Td>
                  <Td>{row.entertainerName ?? <span className="text-slate-400">Venue-wide</span>}</Td>
                  <Td>{row.guest}</Td>
                  <Td>
                    <Badge tone={paymentTone(row.status)}>{titleCase(row.status)}</Badge>
                  </Td>
                  <Td className="font-mono text-xs break-all text-slate-500">{row.reference}</Td>
                </tr>
              ))}
            </Table>
            <Pager
              basePath="/dashboard/transactions"
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
