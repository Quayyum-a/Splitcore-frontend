import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
import { listVenues } from "@/lib/api/dashboard";
import { getSession } from "@/lib/session";

import { VenueCreateForm } from "./VenueCreateForm";
import { setVenueActiveAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "All venues" };

/**
 * Cross-venue management, platform admins only.
 *
 * GET /venues is already role-filtered by the backend — a VENUE_ADMIN sees only
 * their own venue — so this page isn't a different data source, it's the
 * unrestricted view of the same one plus the create/deactivate actions only a
 * platform admin is permitted to call.
 */
export default async function VenuesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // A venue admin has no business here, and the create/deactivate calls would
  // 403 anyway. Send them back rather than showing a page of dead buttons.
  if (session.user.role !== "PLATFORM_ADMIN") redirect("/dashboard");

  const venues = await listVenues(session.token).catch(() => null);

  const sorted = venues
    ? [...venues].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
    : null;

  return (
    <>
      <PageHeader
        title="All venues"
        description="Every venue on the platform. Only platform admins can see or change this."
      />

      <div className="mb-6">
        <Card>
          <CardHeader title="Add a venue" />
          <VenueCreateForm />
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Venues"
          description="Deactivating a venue is a soft delete — its QR codes stop resolving for guests."
        />
        {sorted === null ? (
          <div className="p-5">
            <ErrorNotice message="Couldn't load venues from the Splitcore API. It may be waking up — reload in a moment." />
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            title="No venues yet"
            detail="Create the first one above to start onboarding entertainers."
          />
        ) : (
          <Table
            head={
              <tr>
                <Th>Name</Th>
                <Th>Slug</Th>
                <Th>Location</Th>
                <Th>Status</Th>
                <Th>{""}</Th>
              </tr>
            }
          >
            {sorted.map((venue) => (
              <tr key={venue.id}>
                <Td className="font-medium text-slate-900">{venue.name}</Td>
                <Td className="font-mono text-xs">{venue.slug}</Td>
                <Td>{venue.location}</Td>
                <Td>
                  <Badge tone={venue.isActive ? "positive" : "neutral"}>
                    {venue.isActive ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td>
                  <form action={setVenueActiveAction}>
                    <input type="hidden" name="venueId" value={venue.id} />
                    <input
                      type="hidden"
                      name="activate"
                      value={venue.isActive ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                        venue.isActive
                          ? "border-red-200 text-red-700 hover:bg-red-50"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {venue.isActive ? "Deactivate" : "Reactivate"}
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
