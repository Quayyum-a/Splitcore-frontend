"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createEntertainerAction, type EntertainerFormState } from "./actions";
import type { Venue } from "@/lib/api/types";

const INITIAL: EntertainerFormState = { error: null, success: null };

export function EntertainerCreateForm({ venues }: { venues: Venue[] }) {
  const [state, formAction] = useActionState(createEntertainerAction, INITIAL);

  return (
    <form action={formAction} className="grid gap-4 px-5 py-5 sm:grid-cols-3">
      <Field label="Stage name" name="stageName" placeholder="DJ Neptune" required />
      <Field label="Legal name" name="legalName" placeholder="Patrick Imohiosen" required />
      <Field
        label="Phone"
        name="phone"
        type="tel"
        placeholder="+2348012345678"
        hint="International format. Must be unique."
        required
      />
      <Field label="Bank name" name="bankName" placeholder="GTBank" />
      <Field
        label="Account number"
        name="accountNumber"
        placeholder="0123456789"
        inputMode="numeric"
      />

      <div>
        <label htmlFor="venueId" className="mb-1.5 block text-sm font-medium text-slate-700">
          Link to venue
        </label>
        <select
          id="venueId"
          name="venueId"
          defaultValue={venues[0]?.id ?? ""}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900"
        >
          <option value="">Don&rsquo;t link yet</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">Needed before they can get a QR code.</p>
      </div>

      {state.error ? (
        <p role="alert" className="sm:col-span-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="sm:col-span-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
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
  name,
  hint,
  ...rest
}: {
  label: string;
  name: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        {...rest}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
      />
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
      {pending ? "Adding…" : "Add entertainer"}
    </button>
  );
}
