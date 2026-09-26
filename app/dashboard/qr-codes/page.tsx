import type { Metadata } from "next";

import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  PageHeader,
} from "@/components/admin/ui";
import { listEntertainers, listQrCodes, listVenues } from "@/lib/api/dashboard";
import { buildTipUrl, getAppUrl } from "@/lib/app-url";
import { requireSession } from "@/lib/session";

import { QrCreateForm } from "./QrCreateForm";
import { deactivateQrCodeAction, regenerateQrCodeAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "QR codes" };

export default async function QrCodesPage() {
  const { token } = await requireSession();

  const [qrCodes, venues, entertainers] = await Promise.all([
    listQrCodes(token).catch(() => null),
    listVenues(token).catch(() => []),
    listEntertainers(token).catch(() => []),
  ]);

  const appUrl = getAppUrl();
  const byId = new Map(entertainers.map((entertainer) => [entertainer.id, entertainer]));
  const venuesById = new Map(venues.map((venue) => [venue.id, venue]));

  const sorted = qrCodes
    ? [...qrCodes].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return b.createdAt.localeCompare(a.createdAt);
      })
    : null;

  return (
    <>
      <PageHeader
        title="QR codes"
        description="Every code encodes this site's own /t/ link, so a scan opens the tipping screen instead of raw API JSON."
      />

      <div className="mb-6">
        <Card>
          <CardHeader title="Generate a code" />
          <QrCreateForm venues={venues} entertainers={entertainers} />
        </Card>
      </div>

      <p className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        Codes point at <code className="font-mono text-slate-700">{appUrl}/t/…</code> — set
        from <code className="font-mono">NEXT_PUBLIC_APP_URL</code>. Check this matches the
        domain you actually hand to guests before printing anything. Regenerating a code
        issues a <strong className="font-semibold text-slate-700">new token</strong> and
        retires the old one — anything already printed stops working.
      </p>

      {sorted === null ? (
        <ErrorNotice message="Couldn't load QR codes from the Splitcore API. It may be waking up — reload in a moment." />
      ) : sorted.length === 0 ? (
        <Card>
          <EmptyState
            title="No QR codes yet"
            detail="Generate one above, then download the PNG and print it for a table."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((qrCode) => {
            const entertainer = qrCode.entertainerId
              ? byId.get(qrCode.entertainerId)
              : undefined;
            const venue = venuesById.get(qrCode.venueId);
            const tipUrl = buildTipUrl(qrCode.publicToken, appUrl);

            return (
              <Card key={qrCode.id} className="flex flex-col p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {entertainer?.stageName ?? venue?.name ?? "Venue-wide"}
                    </p>
                    <p className="truncate text-xs text-slate-500">{qrCode.location}</p>
                  </div>
                  <Badge tone={qrCode.isActive ? "positive" : "neutral"}>
                    {qrCode.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="flex justify-center rounded-lg border border-slate-200 bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/qr/${encodeURIComponent(qrCode.publicToken)}/png?size=320`}
                    alt={`QR code linking to ${tipUrl}`}
                    width={160}
                    height={160}
                    className={qrCode.isActive ? "" : "opacity-35 grayscale"}
                  />
                </div>

                <p className="mt-3 font-mono text-[0.68rem] break-all text-slate-400">
                  {tipUrl}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <a
                    href={`/api/qr/${encodeURIComponent(qrCode.publicToken)}/png?size=1024&download=1`}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Download PNG
                  </a>
                  <form action={regenerateQrCodeAction}>
                    <input type="hidden" name="qrCodeId" value={qrCode.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Regenerate
                    </button>
                  </form>
                  {qrCode.isActive ? (
                    <form action={deactivateQrCodeAction}>
                      <input type="hidden" name="qrCodeId" value={qrCode.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Deactivate
                      </button>
                    </form>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
