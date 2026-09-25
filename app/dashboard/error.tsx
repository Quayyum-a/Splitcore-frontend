"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const expired = error.message === "UNAUTHENTICATED";

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">
        {expired ? "Your session expired" : "Something went wrong"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {expired
          ? "Sign in again to carry on."
          : "The Splitcore API may be waking up from a cold start. Try again in a moment."}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        {expired ? (
          <a
            href="/login"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Sign in
          </a>
        ) : (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
