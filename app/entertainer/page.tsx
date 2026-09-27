import type { Metadata } from "next";

import { getBanks } from "@/lib/api/banks";
import { getKycStatus } from "@/lib/api/kyc";
import {
  getEntertainerOverview,
  getEntertainerPayouts,
  getEntertainerTransactions,
} from "@/lib/api/insights";
import type { PayoutRow, TransactionRow } from "@/lib/api/types";
import { getEntertainerSession } from "@/lib/entertainer-session";
import { formatNaira } from "@/lib/money";

import { Onboarding } from "./Onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My earnings" };

/**
 * The entertainer's own dashboard.
 *
 * Every figure is their SHARE, summed by the backend from their ledger credits
 * — not gross tips, and never totalled here from a page of a paginated list. A
 * number that fails to load says so; it does not fall back to zero, because on
 * a money screen "nothing yet" and "we couldn't check" are different answers.
 */
export default async function EntertainerPage() {
  const session = await getEntertainerSession();

  if (!session) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="text-xl font-semibold text-cream">You&rsquo;re signed out</h1>
        <p className="mt-3 max-w-[19rem] text-sm leading-relaxed text-ink-400">
          Ask your venue to send you a new sign-in link. They expire after 30 minutes and
          work once.
        </p>
      </section>
    );
  }

  const { token, entertainerId, stageName } = session;

  const [kyc, banks, overview, transactions, payouts] = await Promise.all([
    getKycStatus(token, entertainerId).catch(() => null),
    getBanks(token),
    getEntertainerOverview(token, entertainerId),
    getEntertainerTransactions(token, entertainerId, { limit: 20 }),
    getEntertainerPayouts(token, entertainerId, { limit: 20 }),
  ]);

  return (
    <>
      <h1 className="text-[1.9rem] leading-tight font-bold tracking-[0.01em] text-cream uppercase">
        {overview?.stageName || stageName}
      </h1>
      <p className="mt-1.5 text-sm text-ink-400">Your earnings</p>

      <div className="mt-6 space-y-2.5">
        <Tile label="Tonight" kobo={overview?.tonightKobo} hero />
        <div className="grid grid-cols-2 gap-2.5">
          <Tile label="This Week" kobo={overview?.thisWeekKobo} />
          <Tile label="Total" kobo={overview?.totalKobo} />
        </div>
      </div>

      {overview ? (
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <Tile label="Awaiting payout" kobo={overview.pendingPayoutsKobo} small />
          <Tile label="Paid out" kobo={overview.paidOutKobo} small />
        </div>
      ) : null}

      {overview === null ? (
        <p className="mt-3 text-xs leading-relaxed text-ink-600">
          We couldn&rsquo;t load your earnings just now. Nothing is lost — pull down to
          refresh in a moment.
        </p>
      ) : null}

      {kyc ? (
        <div className="mt-6">
          <Onboarding kyc={kyc} banks={banks} />
        </div>
      ) : (
        <p className="mt-6 rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3.5 text-sm leading-relaxed text-ink-400">
          We couldn&rsquo;t load your payout setup just now. Try again in a moment.
        </p>
      )}

      <Section
        title="Tips"
        empty="No tips yet."
        failed={transactions === null ? "We couldn't load your tips just now." : null}
        total={transactions?.total}
      >
        {transactions && transactions.items.length > 0 ? (
          <ul className="divide-y divide-ink-800">
            {transactions.items.map((row) => (
              <TransactionItem key={row.id} row={row} />
            ))}
          </ul>
        ) : null}
      </Section>

      <Section
        title="Payouts"
        empty="No payouts yet."
        failed={payouts === null ? "We couldn't load your payouts just now." : null}
        total={payouts?.total}
      >
        {payouts && payouts.items.length > 0 ? (
          <ul className="divide-y divide-ink-800">
            {payouts.items.map((row) => (
              <PayoutItem key={row.id} row={row} />
            ))}
          </ul>
        ) : null}
      </Section>
    </>
  );
}

function Tile({
  label,
  kobo,
  hero = false,
  small = false,
}: {
  label: string;
  kobo?: number;
  hero?: boolean;
  small?: boolean;
}) {
  const missing = kobo === undefined;
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 px-4 py-4">
      <p className="text-xs tracking-[0.1em] text-ink-400 uppercase">{label}</p>
      {missing ? (
        <p className="mt-2 text-sm font-medium text-ink-600">Not yet available</p>
      ) : (
        <p
          className={`tabular mt-2 leading-none font-bold ${
            hero ? "text-[2.4rem] text-gold-bright" : small ? "text-lg text-ink-300" : "text-2xl text-cream"
          }`}
        >
          {formatNaira(kobo)}
        </p>
      )}
    </div>
  );
}

/**
 * "Nothing here yet" and "we couldn't check" are different answers, and on a
 * money screen showing the first when the second is true is a lie. `failed`
 * takes precedence over `empty` for exactly that reason.
 */
function Section({
  title,
  empty,
  failed,
  total,
  children,
}: {
  title: string;
  empty: string;
  failed: string | null;
  total?: number;
  children: React.ReactNode;
}) {
  const hasRows = children !== null && children !== undefined && children !== false;
  const showing = hasRows && total !== undefined;

  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-xs font-medium tracking-[0.1em] text-ink-400 uppercase">
          {title}
        </h2>
        {showing ? <span className="tabular text-xs text-ink-600">{total}</span> : null}
      </div>
      <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        {failed ? (
          <p className="px-4 py-6 text-center text-sm leading-relaxed text-ink-400">
            {failed}
          </p>
        ) : hasRows ? (
          children
        ) : (
          <p className="px-4 py-6 text-center text-sm text-ink-600">{empty}</p>
        )}
      </div>
    </section>
  );
}

function TransactionItem({ row }: { row: TransactionRow }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="tabular text-base font-semibold text-cream">
          {formatNaira(row.amountKobo)}
        </p>
        <p className="truncate text-xs text-ink-400">
          {row.guest} · {formatTime(row.time)}
        </p>
      </div>
      <span
        className={`shrink-0 text-xs font-medium ${
          row.status === "SUCCESS" ? "text-success" : "text-ink-400"
        }`}
      >
        {row.status === "SUCCESS" ? "Received" : titleCase(row.status)}
      </span>
    </li>
  );
}

function PayoutItem({ row }: { row: PayoutRow }) {
  const paid = row.status === "PAID";
  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="tabular text-base font-semibold text-cream">
          {formatNaira(row.amountKobo)}
        </p>
        <span
          className={`shrink-0 text-xs font-medium ${
            paid ? "text-success" : row.status === "FAILED" ? "text-danger" : "text-gold"
          }`}
        >
          {titleCase(row.status)}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-ink-400">{formatTime(row.time)}</p>
      {row.failureReason ? (
        <p className="mt-1 text-xs leading-relaxed text-danger/80">{row.failureReason}</p>
      ) : null}
    </li>
  );
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
}
