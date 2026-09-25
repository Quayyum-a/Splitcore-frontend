import { GuestShell } from "./GuestShell";

/**
 * Shown while the token resolves against the backend. Render's free tier can
 * cold-start, so this is a real wait on a first scan of the night — it gets a
 * deliberate screen rather than a blank one.
 */
export default function Loading() {
  return (
    <GuestShell>
      <div className="flex flex-1 flex-col items-center justify-center">
        <span className="relative flex h-12 w-12 items-center justify-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-gold-500/50"
            style={{ animation: "sc-pulse-ring 1.6s ease-out infinite" }}
          />
          <span className="h-3 w-3 rounded-full bg-gold-500" />
        </span>
        <p className="mt-6 text-sm text-ink-400">Loading…</p>
      </div>
    </GuestShell>
  );
}
