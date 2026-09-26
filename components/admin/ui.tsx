import type { ReactNode } from "react";

import type { KycStatus } from "@/lib/api/types";

/**
 * Shared admin primitives. The dashboard's visual brief is sober
 * financial-infrastructure software: real numbers, dense tables, no gimmicks.
 */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-slate-200 px-5 py-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
    </div>
  );
}

/**
 * A metric tile.
 *
 * `value` is for numbers that came from a confirmed endpoint. When the data
 * does not exist yet, pass `unavailable` instead — the tile then says so
 * plainly. This product's pitch to venues is trustworthy numbers, so a tile
 * must never render a figure that looks real but isn't.
 */
export function StatTile({
  label,
  value,
  unavailable,
  hint,
}: {
  label: string;
  value?: string;
  unavailable?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      {unavailable ? (
        <>
          <p className="mt-2 text-sm font-medium text-slate-400">Not yet available</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{unavailable}</p>
        </>
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </>
      )}
    </div>
  );
}

/** For whole screens whose backing endpoint does not exist yet. */
export function ComingSoon({
  title,
  blockedBy,
  children,
}: {
  title: string;
  blockedBy: string;
  children?: ReactNode;
}) {
  return (
    <Card className="px-6 py-12 text-center">
      <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        {blockedBy}
      </p>
      {children}
      <p className="mt-6 text-xs text-slate-400">
        Tracked in <code className="font-mono">docs/api-audit.md</code>
      </p>
    </Card>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">{detail}</p>
    </div>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      {message}
    </div>
  );
}

const BADGE_TONES = {
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/20",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
} as const;

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium tracking-wide text-slate-500 uppercase">
          {head}
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children }: { children: ReactNode }) {
  return <th className="px-5 py-3 font-medium whitespace-nowrap">{children}</th>;
}

export function Td({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-5 py-3.5 align-middle text-slate-700 ${className}`}>{children}</td>;
}

/** KYC state, coloured by how much it should worry a venue manager. */
export function KycBadge({ status }: { status: KycStatus }) {
  const tone =
    status === "VERIFIED"
      ? "positive"
      : status === "FAILED" || status === "SUSPENDED"
        ? "danger"
        : status === "PENDING" || status === "REVIEW"
          ? "warning"
          : "neutral";

  return <Badge tone={tone}>{status.replace(/_/g, " ").toLowerCase()}</Badge>;
}
