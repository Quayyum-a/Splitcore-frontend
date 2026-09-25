import type { Metadata } from "next";
import Link from "next/link";

import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import { getActiveSplitRule, listSplitRules, listVenues } from "@/lib/api/dashboard";
import { formatBps } from "@/lib/money";
import { requireSession } from "@/lib/session";

import { SplitRuleForm } from "./SplitRuleForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Split rules" };

/** Sensible starting point when a venue has no rule yet: 70 / 25 / 5. */
const DEFAULT_SPLIT = { entertainerBps: 7000, venueBps: 2500, platformBps: 500 };

export default async function SplitRulesPage({
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
        <PageHeader title="Split rules" />
        <ErrorNotice message="Couldn't load venues from the Splitcore API. It may be waking up — reload in a moment." />
      </>
    );
  }

  if (venues.length === 0) {
    return (
      <>
        <PageHeader title="Split rules" />
        <Card>
          <EmptyState
            title="No venues on this account"
            detail="Split rules are configured per venue, so there's nothing to set up yet."
          />
        </Card>
      </>
    );
  }

  const selectedVenue = venues.find((v) => v.id === venueParam) ?? venues[0];

  const [active, history] = await Promise.all([
    getActiveSplitRule(token, selectedVenue.id).catch(() => null),
    listSplitRules(token, selectedVenue.id).catch(() => null),
  ]);

  return (
    <>
      <PageHeader
        title="Split rules"
        description="How each tip is divided between the entertainer, the venue and Splitcore."
      />

      {/* A venue with no active rule cannot take tips at all — the payment
          endpoint rejects it outright. That's worth saying loudly. */}
      {active === null ? (
        <div className="mb-6">
          <ErrorNotice message={`${selectedVenue.name} has no active split rule, so it cannot accept tips. Payments will be rejected until one is set below.`} />
        </div>
      ) : null}

      {venues.length > 1 ? (
        <nav className="mb-6 flex flex-wrap gap-2">
          {venues.map((venue) => (
            <Link
              key={venue.id}
              href={`/dashboard/split-rules?venue=${venue.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                venue.id === selectedVenue.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {venue.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SplitTile label="Entertainer" bps={active?.entertainerBps} />
        <SplitTile label="Venue" bps={active?.venueBps} />
        <SplitTile label="Splitcore" bps={active?.platformBps} />
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader
            title={`Set a new split for ${selectedVenue.name}`}
            description="Shares are stored as basis points and must total exactly 100%."
          />
          <SplitRuleForm
            venues={venues}
            selectedVenueId={selectedVenue.id}
            initial={active ?? DEFAULT_SPLIT}
          />
        </Card>
      </div>

      <Card>
        <CardHeader title="History" description="Every rule this venue has ever used." />
        {history === null ? (
          <div className="p-5">
            <ErrorNotice message="Couldn't load split-rule history." />
          </div>
        ) : history.length === 0 ? (
          <EmptyState
            title="No rules yet"
            detail="The first rule you save will appear here."
          />
        ) : (
          <Table
            head={
              <tr>
                <Th>Entertainer</Th>
                <Th>Venue</Th>
                <Th>Splitcore</Th>
                <Th>Effective from</Th>
                <Th>Effective to</Th>
                <Th>Status</Th>
              </tr>
            }
          >
            {[...history]
              .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
              .map((rule) => (
                <tr key={rule.id}>
                  <Td className="tabular-nums">{formatBps(rule.entertainerBps)}</Td>
                  <Td className="tabular-nums">{formatBps(rule.venueBps)}</Td>
                  <Td className="tabular-nums">{formatBps(rule.platformBps)}</Td>
                  <Td className="tabular-nums">{formatDate(rule.effectiveFrom)}</Td>
                  <Td className="tabular-nums">
                    {rule.effectiveTo ? formatDate(rule.effectiveTo) : "—"}
                  </Td>
                  <Td>
                    <Badge tone={rule.effectiveTo ? "neutral" : "positive"}>
                      {rule.effectiveTo ? "Closed" : "Active"}
                    </Badge>
                  </Td>
                </tr>
              ))}
          </Table>
        )}
      </Card>
    </>
  );
}

function SplitTile({ label, bps }: { label: string; bps?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
        {bps === undefined ? <span className="text-slate-300">—</span> : formatBps(bps)}
      </p>
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
}
