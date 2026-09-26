"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { createQrCodeAction, type QrActionState } from "./actions";
import type { Entertainer, Venue } from "@/lib/api/types";

const INITIAL: QrActionState = { error: null };

export function QrCreateForm({
  venues,
  entertainers,
}: {
  venues: Venue[];
  entertainers: Entertainer[];
}) {
  const [state, formAction] = useActionState(createQrCodeAction, INITIAL);
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");

  // Only entertainers linked to the chosen venue can receive its tips.
  const eligible = entertainers.filter(
    (entertainer) => entertainer.isActive && entertainer.venueIds.includes(venueId),
  );

  if (venues.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-slate-500">
        No venues available on this account, so there&rsquo;s nothing to generate a code
        for yet.
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-4 px-5 py-5 sm:grid-cols-3">
      <Field label="Venue" htmlFor="venueId">
        <select
          id="venueId"
          name="venueId"
          value={venueId}
          onChange={(event) => setVenueId(event.target.value)}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900"
        >
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Entertainer"
        htmlFor="entertainerId"
        hint="Leave blank for a venue-wide code."
      >
        <select
          id="entertainerId"
          name="entertainerId"
          defaultValue=""
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900"
        >
          <option value="">Venue-wide (no entertainer)</option>
          {eligible.map((entertainer) => (
            <option key={entertainer.id} value={entertainer.id}>
              {entertainer.stageName}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Location" htmlFor="location" hint="Printed on the code's record.">
        <input
          id="location"
          name="location"
          required
          maxLength={80}
          placeholder="Table 5"
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
        />
      </Field>

      {state.error ? (
        <p role="alert" className="sm:col-span-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.createdToken ? (
        <p className="sm:col-span-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          QR code created. It&rsquo;s at the top of the list below — download the PNG to print it.
        </p>
      ) : null}

      <div className="sm:col-span-3">
        <Submit />
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? "Generating…" : "Generate QR code"}
    </button>
  );
}
