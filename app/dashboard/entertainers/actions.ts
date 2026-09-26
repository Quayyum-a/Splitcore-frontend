"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { issueLoginLink } from "@/lib/api/kyc";
import {
  createEntertainer,
  deactivateEntertainer,
  linkEntertainerToVenue,
  unlinkEntertainerFromVenue,
  updateEntertainer,
} from "@/lib/api/dashboard";
import { requireSession } from "@/lib/session";

export interface EntertainerFormState {
  error: string | null;
  success: string | null;
}

function toMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session expired. Sign in again.";
    if (error.status === 403) return "You don't have access to do that.";
    if (error.status === 409) return "An entertainer with that phone number already exists.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function createEntertainerAction(
  _previous: EntertainerFormState,
  formData: FormData,
): Promise<EntertainerFormState> {
  const stageName = String(formData.get("stageName") ?? "").trim();
  const legalName = String(formData.get("legalName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const bankName = String(formData.get("bankName") ?? "").trim();
  const accountNumber = String(formData.get("accountNumber") ?? "").trim();
  const venueId = String(formData.get("venueId") ?? "").trim();

  if (!stageName || !legalName || !phone) {
    return { error: "Stage name, legal name and phone are all required.", success: null };
  }
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    return {
      error: "Phone must be in international format, e.g. +2348012345678.",
      success: null,
    };
  }

  try {
    const { token } = await requireSession();
    const entertainer = await createEntertainer(token, {
      stageName,
      legalName,
      phone,
      ...(bankName ? { bankName } : {}),
      ...(accountNumber ? { accountNumber } : {}),
    });

    // Creation doesn't attach the entertainer to a venue; that's a separate
    // endpoint, and without it they can't be picked for a QR code.
    if (venueId) {
      await linkEntertainerToVenue(token, entertainer.id, venueId).catch(() => null);
    }

    revalidatePath("/dashboard/entertainers");
    return { error: null, success: `${entertainer.stageName} added.` };
  } catch (error) {
    return { error: toMessage(error), success: null };
  }
}

export async function setEntertainerActiveAction(formData: FormData): Promise<void> {
  const entertainerId = String(formData.get("entertainerId") ?? "");
  const activate = String(formData.get("activate") ?? "") === "true";
  const { token } = await requireSession();

  if (activate) {
    await updateEntertainer(token, entertainerId, { isActive: true });
  } else {
    // DELETE is the backend's soft-deactivate, and it cascades to QR codes.
    await deactivateEntertainer(token, entertainerId);
  }
  revalidatePath("/dashboard/entertainers");
}

export async function toggleVenueLinkAction(formData: FormData): Promise<void> {
  const entertainerId = String(formData.get("entertainerId") ?? "");
  const venueId = String(formData.get("venueId") ?? "");
  const link = String(formData.get("link") ?? "") === "true";
  const { token } = await requireSession();

  if (link) await linkEntertainerToVenue(token, entertainerId, venueId);
  else await unlinkEntertainerFromVenue(token, entertainerId, venueId);

  revalidatePath("/dashboard/entertainers");
}

/**
 * Issues a one-time sign-in link for an entertainer.
 *
 * There is no notification channel — entertainers have a phone number but no
 * email, and no notifications module exists — so the venue delivers it by hand.
 * The link is single use, expires in 30 minutes, and issuing a new one
 * invalidates any outstanding link, so this is never fire-and-forget: the
 * dashboard has to show it and the venue has to pass it on.
 */
export async function issueLoginLinkAction(
  _previous: LoginLinkState,
  formData: FormData,
): Promise<LoginLinkState> {
  const entertainerId = String(formData.get("entertainerId") ?? "");
  const stageName = String(formData.get("stageName") ?? "");

  try {
    const { token } = await requireSession();
    const link = await issueLoginLink(token, entertainerId);
    return { error: null, loginUrl: link.loginUrl, expiresAt: link.expiresAt, stageName };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return { error: "That entertainer doesn't perform at your venue.", loginUrl: null };
    }
    return { error: toMessage(error), loginUrl: null };
  }
}

export interface LoginLinkState {
  error: string | null;
  loginUrl: string | null;
  expiresAt?: string;
  stageName?: string;
}
