"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { createVenueAction, type VenueFormState } from "./actions";

const INITIAL: VenueFormState = { error: null, success: null };

/** Slug is derived as you type but stays editable — it's part of the venue's identity. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function VenueCreateForm() {
  const [state, formAction] = useActionState(createVenueAction, INITIAL);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={formAction} className="grid gap-4 px-5 py-5 sm:grid-cols-2">
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
          Venue name
        </label>
        <input
          id="name"
          name="name"
          required
          placeholder="Quilox Nightclub"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
        />
      </div>

      <div>
        <label htmlFor="slug" className="mb-1.5 block text-sm font-medium text-slate-700">
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          required
          placeholder="quilox-nightclub"
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900"
        />
        <p className="mt-1 text-xs text-slate-500">Lowercase letters, numbers and hyphens.</p>
      </div>

      <div>
        <label htmlFor="location" className="mb-1.5 block text-sm font-medium text-slate-700">
          Location
        </label>
        <input
          id="location"
          name="location"
          required
          placeholder="Victoria Island, Lagos"
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
        />
      </div>

      <div>
        <label htmlFor="logoUrl" className="mb-1.5 block text-sm font-medium text-slate-700">
          Logo URL
        </label>
        <input
          id="logoUrl"
          name="logoUrl"
          type="url"
          placeholder="https://…"
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
        />
        <p className="mt-1 text-xs text-slate-500">Optional.</p>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 sm:col-span-2">
          {state.success}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <Submit />
      </div>
    </form>
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
      {pending ? "Creating…" : "Create venue"}
    </button>
  );
}
