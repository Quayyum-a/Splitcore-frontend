"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { createVenue, deactivateVenue, updateVenue } from "@/lib/api/dashboard";
import { requirePlatformAdmin } from "@/lib/session";

export interface VenueFormState {
  error: string | null;
  success: string | null;
}

function toMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session expired. Sign in again.";
    if (error.status === 403) return "Only a platform admin can do that.";
    if (error.status === 409) return "A venue with that slug already exists.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function createVenueAction(
  _previous: VenueFormState,
  formData: FormData,
): Promise<VenueFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const location = String(formData.get("location") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();

  if (!name || !slug || !location) {
    return { error: "Name, slug and location are all required.", success: null };
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return {
      error: "Slug can only use lowercase letters, numbers and hyphens.",
      success: null,
    };
  }

  try {
    const { token } = await requirePlatformAdmin();
    const venue = await createVenue(token, {
      name,
      slug,
      location,
      ...(logoUrl ? { logoUrl } : {}),
    });
    revalidatePath("/dashboard/venues");
    return { error: null, success: `${venue.name} created.` };
  } catch (error) {
    return { error: toMessage(error), success: null };
  }
}

export async function setVenueActiveAction(formData: FormData): Promise<void> {
  const venueId = String(formData.get("venueId") ?? "");
  const activate = String(formData.get("activate") ?? "") === "true";
  const { token } = await requirePlatformAdmin();

  if (activate) await updateVenue(token, venueId, { isActive: true });
  else await deactivateVenue(token, venueId);

  revalidatePath("/dashboard/venues");
}
