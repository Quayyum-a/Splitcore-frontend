import Link from "next/link";

import type { Venue } from "@/lib/api/types";

/** Only rendered when the caller can actually see more than one venue. */
export function VenuePicker({
  venues,
  selectedId,
  basePath,
}: {
  venues: Venue[];
  selectedId: string | undefined;
  basePath: string;
}) {
  if (venues.length <= 1) return null;
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {venues.map((venue) => (
        <Link
          key={venue.id}
          href={`${basePath}?venue=${venue.id}`}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
            venue.id === selectedId
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {venue.name}
        </Link>
      ))}
    </nav>
  );
}

export function Pager({
  basePath,
  venueId,
  offset,
  limit,
  total,
}: {
  basePath: string;
  venueId: string;
  offset: number;
  limit: number;
  total: number;
}) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const prev = Math.max(0, offset - limit);
  const next = offset + limit;

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
      <p className="tabular-nums text-xs text-slate-500">
        {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        <PagerLink
          href={`${basePath}?venue=${venueId}&offset=${prev}`}
          disabled={offset === 0}
        >
          Previous
        </PagerLink>
        <PagerLink
          href={`${basePath}?venue=${venueId}&offset=${next}`}
          disabled={next >= total}
        >
          Next
        </PagerLink>
      </div>
    </div>
  );
}

function PagerLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-300">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}

export function formatLagos(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
}

const PAYMENT_TONES: Record<string, "positive" | "neutral" | "warning" | "danger"> = {
  SUCCESS: "positive",
  PENDING: "warning",
  CREATED: "warning",
  FAILED: "danger",
  ABANDONED: "neutral",
  REVERSED: "neutral",
  REFUNDED: "neutral",
};

const PAYOUT_TONES: Record<string, "positive" | "neutral" | "warning" | "danger"> = {
  PAID: "positive",
  QUEUED: "warning",
  RETRYING: "warning",
  PROCESSING: "warning",
  FAILED: "danger",
  CANCELLED: "neutral",
};

export const paymentTone = (status: string) => PAYMENT_TONES[status] ?? "neutral";
export const payoutTone = (status: string) => PAYOUT_TONES[status] ?? "neutral";

export const titleCase = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
