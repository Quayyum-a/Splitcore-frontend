import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  PageHeader,
  SplitStatusBadge,
  Table,
  Td,
  Th,
} from "@/components/admin/ui";
import {
  getActiveSplitRule,
  getPlatformSettings,
  listEntertainers,
  listSplitRules,
  listVenues,
} from "@/lib/api/dashboard";
import { effectiveStatus } from "@/lib/api/types";
import { formatBps } from "@/lib/money";
import { requireSession } from "@/lib/session";

import { OverrideForm, PlatformFeeForm } from "./AdminControls";
import { LegacySplitForm } from "./LegacySplitForm";
import { LockedPlatformFee, ProposeSplitForm } from "./ProposeSplitForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Split rules" };

/** Only used when a venue has no rule at all, so there's nothing to carry forward. */
const STARTING_SPLIT = { entertainerBps: 7000, venueBps: 2500, platformBps: 500 };

export default async function SplitRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ venue?: string }>;
}) {
  const session = await requireSession();
  const { token } = session;
  const isPlatformAdmin = session.user.role === "PLATFORM_ADMIN";
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

  // One probe drives the whole page rather than each surface guessing. Note it
  // is NOT wrapped in `.catch(() => …)`: swallowing a failure here is exactly
  // how a broken backend came to look like an old one.
  const [probe, active, history, entertainers] = await Promise.all([
    getPlatformSettings(token),
    getActiveSplitRule(token, selectedVenue.id).catch(() => null),
    listSplitRules(token, selectedVenue.id).catch(() => null),
    listEntertainers(token).catch(() => null),
  ]);

  const governed = probe.kind === "available";
  const settings = probe.kind === "available" ? probe.settings : null;
  const pending = (history ?? []).filter(
    (rule) => effectiveStatus(rule) === "PENDING_ENTERTAINER_APPROVAL",
  );
  const venueEntertainers = (entertainers ?? []).filter(
    (e) => e.isActive && e.venueIds.includes(selectedVenue.id),
  );

  return (
    <>
      <PageHeader
        title="Split rules"
        description={
          governed
            ? "How each tip is divided. A split only counts once the entertainer has agreed to it."
            : "How each tip is divided between the entertainer, the venue and Splitcore."
        }
      />

      {probe.kind === "broken" ? (
        <div className="mb-6">
          <ErrorNotice
            message={`Splits are unavailable: the API returned ${probe.status || "no response"} for the platform fee (${probe.message}). Neither proposing nor editing a split will work until that's fixed, so no form is shown. If split-rule endpoints were just deployed, the database migration may not have been applied.`}
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

      {/* A venue with no ACTIVE rule cannot take tips: payment initialization
          refuses rather than guessing a split. Say it loudly. */}
      {active === null && probe.kind !== "broken" ? (
        <div className="mb-6">
          <ErrorNotice
            message={`${selectedVenue.name} has no agreed split, so it can't accept tips. Payments will be rejected until one is ${governed ? "proposed and accepted" : "saved"}.`}
          />
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SplitTile label="Entertainer" bps={active?.entertainerBps} />
        <SplitTile label="Venue" bps={active?.venueBps} />
        <SplitTile label="Splitcore" bps={active?.platformBps} />
      </div>

      {governed && pending.length > 0 ? (
        <div className="mb-6">
          <Card>
            <CardHeader
              title="Awaiting entertainer approval"
              description="These divide no money. They take effect only if accepted."
            />
            <Table
              head={
                <tr>
                  <Th>Entertainer</Th>
                  <Th>Venue</Th>
                  <Th>Splitcore</Th>
                  <Th>Proposed</Th>
                  <Th>Status</Th>
                </tr>
              }
            >
              {pending.map((rule) => (
                <tr key={rule.id}>
                  <Td className="tabular-nums">{formatBps(rule.entertainerBps)}</Td>
                  <Td className="tabular-nums">{formatBps(rule.venueBps)}</Td>
                  <Td className="tabular-nums">{formatBps(rule.platformBps)}</Td>
                  <Td className="tabular-nums">
                    {rule.proposedAt ? formatDate(rule.proposedAt) : "—"}
                  </Td>
                  <Td>
                    <SplitStatusBadge status="PENDING_ENTERTAINER_APPROVAL" />
                  </Td>
                </tr>
              ))}
            </Table>
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              The approval link is shown once when a proposal is created and can&rsquo;t be
              retrieved afterwards. If it was lost, propose the split again to get a new one.
            </p>
          </Card>
        </div>
      ) : null}

      {probe.kind === "broken" ? null : (
      <div className="mb-6">
        <Card>
          <CardHeader
            title={
              governed
                ? `Propose a split for ${selectedVenue.name}`
                : `Set the split for ${selectedVenue.name}`
            }
            description={
              governed
                ? "The entertainer has to accept before it divides any money."
                : "Move the slider to divide what's left after the platform fee."
            }
          />
          {governed && settings ? (
            <ProposeSplitForm
              venueId={selectedVenue.id}
              entertainers={venueEntertainers}
              settings={settings}
              initialEntertainerBps={active?.entertainerBps ?? STARTING_SPLIT.entertainerBps}
            />
          ) : (
            <LegacySplitForm
              selectedVenueId={selectedVenue.id}
              initial={active ?? STARTING_SPLIT}
              canEditPlatformFee={isPlatformAdmin}
            />
          )}
        </Card>
      </div>
      )}

      {governed && settings ? (
        <>
          {isPlatformAdmin ? (
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Platform fee" description="Splitcore's cut. Platform admins only." />
                <PlatformFeeForm settings={settings} />
              </Card>
              <Card>
                <CardHeader title="Override" description="The exception, not the process." />
                <OverrideForm
                  venueId={selectedVenue.id}
                  venueName={selectedVenue.name}
                  initial={
                    active
                      ? {
                          entertainerBps: active.entertainerBps,
                          venueBps: active.venueBps,
                          platformBps: active.platformBps,
                        }
                      : STARTING_SPLIT
                  }
                />
              </Card>
            </div>
          ) : (
            <div className="mb-6">
              <Card className="px-5 py-5">
                <LockedPlatformFee bps={settings.platformFeeBps} />
              </Card>
            </div>
          )}
        </>
      ) : probe.kind === "absent" ? (
        /* Legacy backend: say what's missing rather than implying this is final. */
        <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
          <p className="text-sm font-medium text-slate-800">
            Entertainer approval isn&rsquo;t live on this backend yet
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            <code className="font-mono text-xs">GET /platform/settings</code> returns 404, so
            this deployment predates split-rule governance. A split saved here takes effect
            immediately with nobody&rsquo;s agreement. The approval flow, the fixed platform
            fee and the pending state are all built and switch on by themselves the moment
            that endpoint exists.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader title="History" description="Every split this venue has proposed or used." />
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
              .sort((a, b) =>
                (b.proposedAt ?? b.effectiveFrom ?? b.createdAt).localeCompare(
                  a.proposedAt ?? a.effectiveFrom ?? a.createdAt,
                ),
              )
              .map((rule) => (
                <tr key={rule.id}>
                  <Td className="tabular-nums">{formatBps(rule.entertainerBps)}</Td>
                  <Td className="tabular-nums">{formatBps(rule.venueBps)}</Td>
                  <Td className="tabular-nums">{formatBps(rule.platformBps)}</Td>
                  <Td className="tabular-nums">
                    {rule.effectiveFrom ? formatDate(rule.effectiveFrom) : "—"}
                  </Td>
                  <Td className="tabular-nums">
                    {rule.effectiveTo ? formatDate(rule.effectiveTo) : "—"}
                  </Td>
                  <Td>
                    <SplitStatusBadge status={effectiveStatus(rule)} origin={rule.origin} />
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
