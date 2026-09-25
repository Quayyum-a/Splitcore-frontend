import type { Metadata } from "next";

import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  KycBadge,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { listEntertainers, listVenues } from "@/lib/api/dashboard";
import { requireSession } from "@/lib/session";

import { EntertainerCreateForm } from "./EntertainerCreateForm";
import { setEntertainerActiveAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entertainers" };

export default async function EntertainersPage() {
  const { token } = await requireSession();

  const [entertainers, venues] = await Promise.all([
    listEntertainers(token).catch(() => null),
    listVenues(token).catch(() => []),
  ]);

  const venuesById = new Map(venues.map((venue) => [venue.id, venue]));

  return (
    <>
      <PageHeader
        title="Entertainers"
        description="Add performers, link them to venues, and see where their KYC stands."
      />

      <div className="mb-6">
        <Card>
          <CardHeader title="Add an entertainer" />
          <EntertainerCreateForm venues={venues} />
        </Card>
      </div>

      <Card>
        <CardHeader
          title="All entertainers"
          description="Payout status needs a payouts endpoint the backend doesn't expose yet, so only KYC is shown."
        />
        {entertainers === null ? (
          <div className="p-5">
            <ErrorNotice message="Couldn't load entertainers from the Splitcore API." />
          </div>
        ) : entertainers.length === 0 ? (
          <EmptyState
            title="No entertainers yet"
            detail="Add one above to start generating QR codes for them."
          />
        ) : (
          <Table
            head={
              <tr>
                <Th>Stage name</Th>
                <Th>Legal name</Th>
                <Th>Phone</Th>
                <Th>Payout account</Th>
                <Th>KYC</Th>
                <Th>Venues</Th>
                <Th>Status</Th>
                <Th>{""}</Th>
              </tr>
            }
          >
            {entertainers.map((entertainer) => (
              <tr key={entertainer.id}>
                <Td className="font-medium text-slate-900">{entertainer.stageName}</Td>
                <Td>{entertainer.legalName}</Td>
                <Td className="tabular-nums">{entertainer.phone}</Td>
                <Td>
                  {entertainer.accountNumber ? (
                    <span className="tabular-nums">
                      {entertainer.bankName ?? "Bank"} ····
                      {entertainer.accountNumber.slice(-4)}
                    </span>
                  ) : (
                    <span className="text-slate-400">Not set</span>
                  )}
                </Td>
                <Td>
                  <KycBadge status={entertainer.kycStatus} />
                </Td>
                <Td className="max-w-[14rem]">
                  {entertainer.venueIds.length === 0 ? (
                    <span className="text-slate-400">None</span>
                  ) : (
                    <span className="text-xs text-slate-600">
                      {entertainer.venueIds
                        .map((id) => venuesById.get(id)?.name ?? "Unknown venue")
                        .join(", ")}
                    </span>
                  )}
                </Td>
                <Td>
                  <Badge tone={entertainer.isActive ? "positive" : "neutral"}>
                    {entertainer.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td>
                  <form action={setEntertainerActiveAction}>
                    <input type="hidden" name="entertainerId" value={entertainer.id} />
                    <input
                      type="hidden"
                      name="activate"
                      value={entertainer.isActive ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                        entertainer.isActive
                          ? "border-red-200 text-red-700 hover:bg-red-50"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                      title={
                        entertainer.isActive
                          ? "Deactivating also deactivates this entertainer's QR codes."
                          : undefined
                      }
                    >
                      {entertainer.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
