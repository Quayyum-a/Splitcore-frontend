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

/**
 * Only used when a venue has never had a rule, so there is nothing to carry
 * forward. Matches the backend's own documented example (70/25/5) rather than
 * being invented here.
 */
const STARTING_SPLIT = { entertainerBps: 7000, venueBps: 2500, platformBps: 500 };

export default async function SplitRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string }>;
}) {
  const session = await requireSession();
  const { token } = session;
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
            detail="Splits are configured per venue, so there's nothing to set up yet."
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

      {/* A venue with no active rule cannot take tips at all — the payments
          endpoint rejects them outright. Worth saying loudly. */}
      {active === null ? (
        <div className="mb-6">
          <ErrorNotice
            message={`${selectedVenue.name} has no active split, so it can't accept tips. Payments will be rejected until one is saved below.`}
          />
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
            title={`Set the split for ${selectedVenue.name}`}
            description="Move the slider to divide what's left after the platform fee."
          />
          <SplitRuleForm
            selectedVenueId={selectedVenue.id}
            initial={active ?? STARTING_SPLIT}
            canEditPlatformFee={session.user.role === "PLATFORM_ADMIN"}
          />
        </Card>
      </div>

      {/* The governance model (entertainer has to agree before a split counts)
          is backend work that has not shipped. Saying so beats implying the
          current behaviour is the final one. */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
        <p className="text-sm font-medium text-slate-800">
          Entertainer approval isn&rsquo;t live yet
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          A split you save here takes effect immediately. Once the backend ships its approval
          flow, a new split will instead wait for the entertainer to accept it, and this page
          will show that pending state plus a link you can send them. Nothing here pretends
          that has already happened.
        </p>
      </div>

      <Card>
        <CardHeader title="History" description="Every split this venue has used." />
        {history === null ? (
          <div className="p-5">
            <ErrorNotice message="Couldn't load split history." />
          </div>
        ) : history.length === 0 ? (
          <EmptyState title="No splits yet" detail="The first one you save appears here." />
        ) : (
          <Table
            head={
              <tr>
                <Th>Entertainer</Th>
                <Th>Venue</Th>
                <Th>Splitcore</Th>
                <Th>In effect from</Th>
                <Th>Until</Th>
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
