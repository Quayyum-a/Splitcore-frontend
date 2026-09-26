import { GuestShell } from "@/components/GuestShell";

/** Shown while the token resolves. Render cold-starts, so this is a real wait. */
export default function Loading() {
  return (
    <GuestShell>
      <div className="flex h-full flex-col items-center justify-center">
        <span className="relative flex h-12 w-12 items-center justify-center">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-gold/50"
            style={{ animation: "sc-pulse-ring 1.6s ease-out infinite" }}
          />
          <span className="h-2.5 w-2.5 rounded-full bg-gold" />
        </span>
        <p className="mt-6 text-sm text-ink-400">Loading</p>
      </div>
    </GuestShell>
  );
}
