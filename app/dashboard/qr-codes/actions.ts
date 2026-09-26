"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { createQrCode, deactivateQrCode, regenerateQrCode } from "@/lib/api/dashboard";
import { requireSession } from "@/lib/session";

export interface QrActionState {
  error: string | null;
  createdToken?: string;
}

function toMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session expired. Sign in again.";
    if (error.status === 403) return "You don't have access to that venue.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function createQrCodeAction(
  _previous: QrActionState,
  formData: FormData,
): Promise<QrActionState> {
  const venueId = String(formData.get("venueId") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const entertainerId = String(formData.get("entertainerId") ?? "").trim();

  if (!venueId) return { error: "Choose a venue." };
  if (!location) return { error: "Enter where this code will be placed." };

  try {
    const { token } = await requireSession();
    const created = await createQrCode(token, {
      venueId,
      location,
      // Omitted entirely for a venue-level code — the backend treats an absent
      // entertainerId as "tips go to the venue", not as an empty string.
      ...(entertainerId ? { entertainerId } : {}),
    });
    revalidatePath("/dashboard/qr-codes");
    return { error: null, createdToken: created.publicToken };
  } catch (error) {
    return { error: toMessage(error) };
  }
}

export async function deactivateQrCodeAction(formData: FormData): Promise<void> {
  const qrCodeId = String(formData.get("qrCodeId") ?? "");
  const { token } = await requireSession();
  await deactivateQrCode(token, qrCodeId);
  revalidatePath("/dashboard/qr-codes");
}

export async function regenerateQrCodeAction(formData: FormData): Promise<void> {
  const qrCodeId = String(formData.get("qrCodeId") ?? "");
  const { token } = await requireSession();
  await regenerateQrCode(token, qrCodeId);
  revalidatePath("/dashboard/qr-codes");
}
