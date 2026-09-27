"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { Bank } from "@/lib/api/types";

/**
 * Pick a bank by name. The provider's code travels with it invisibly.
 *
 * Nobody knows their bank's Paystack code, and a typed one is a silent way to
 * send money to the wrong institution — so the code is never shown and never
 * typed. It rides along in a hidden input and is what actually gets submitted,
 * because the backend treats a code as unambiguous and a name as something it
 * may have to reject ("First Bank" matches more than one).
 *
 * The list is the live `GET /banks` response, several hundred long, so this is
 * a filtering combobox rather than a select: scrolling 263 options one-handed
 * is not a thing anyone should be asked to do.
 */

type Tone = "dark" | "light";

const TONES: Record<
  Tone,
  {
    field: string;
    label: string;
    list: string;
    option: string;
    optionActive: string;
    hint: string;
    error: string;
    clear: string;
  }
> = {
  dark: {
    field:
      "h-[3.25rem] w-full rounded-2xl border border-ink-700 bg-ink-850 px-4 text-base text-cream outline-none placeholder:text-ink-600 focus:border-gold",
    label: "mb-1.5 block text-xs font-medium tracking-[0.1em] text-ink-400 uppercase",
    list: "absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto overscroll-contain rounded-2xl border border-ink-700 bg-ink-900 py-1 shadow-xl",
    option: "cursor-pointer px-4 py-2.5 text-sm text-ink-300",
    optionActive: "bg-gold/15 text-cream",
    hint: "mt-1.5 text-xs leading-relaxed text-ink-600",
    error: "mt-1.5 text-xs leading-relaxed text-danger",
    clear: "text-ink-400 hover:text-cream",
  },
  light: {
    field:
      "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900",
    label: "mb-1.5 block text-sm font-medium text-slate-700",
    list: "absolute z-20 mt-1 max-h-64 w-full overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white py-1 shadow-lg",
    option: "cursor-pointer px-3 py-2 text-sm text-slate-700",
    optionActive: "bg-slate-100 text-slate-900",
    hint: "mt-1 text-xs text-slate-500",
    error: "mt-1 text-xs text-red-600",
    clear: "text-slate-400 hover:text-slate-700",
  },
};

/** Enough to scroll through; the filter is what actually finds a bank. */
const MAX_VISIBLE = 60;

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function BankPicker({
  banks,
  name = "bankCode",
  label = "Bank",
  tone = "light",
  defaultBankName = null,
  defaultBankCode = null,
  required = true,
}: {
  /** `null` means the list could not be loaded — a real error, not "no banks". */
  banks: Bank[] | null;
  name?: string;
  label?: string;
  tone?: Tone;
  defaultBankName?: string | null;
  defaultBankCode?: string | null;
  required?: boolean;
}) {
  const t = TONES[tone];
  const id = useId();
  const listId = `${id}-list`;

  const [selected, setSelected] = useState<Bank | null>(
    defaultBankCode && defaultBankName
      ? { code: defaultBankCode, name: defaultBankName }
      : null,
  );
  const [query, setQuery] = useState(defaultBankName ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => {
    if (!banks) return [];
    const q = normalise(query);
    // An empty query (or one that still equals the selection) shows everything,
    // so opening the field never looks like "no results".
    if (!q || (selected && normalise(selected.name) === q)) {
      return banks.slice(0, MAX_VISIBLE);
    }
    const starts: Bank[] = [];
    const contains: Bank[] = [];
    for (const bank of banks) {
      const n = normalise(bank.name);
      if (n.startsWith(q)) starts.push(bank);
      else if (n.includes(q)) contains.push(bank);
      if (starts.length >= MAX_VISIBLE) break;
    }
    return [...starts, ...contains].slice(0, MAX_VISIBLE);
  }, [banks, query, selected]);

  // Close when focus or a click leaves the component.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  // Keep the highlighted option in view when arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (banks === null) {
    return (
      <div>
        <span className={t.label}>{label}</span>
        <div
          className={`${t.field} flex items-center ${
            tone === "dark" ? "text-ink-600" : "text-slate-400"
          }`}
        >
          Bank list unavailable
        </div>
        <p role="alert" className={t.error}>
          We couldn&rsquo;t load the list of banks, so an account can&rsquo;t be added right
          now. This is a connection problem, not an empty list — try again in a moment.
        </p>
      </div>
    );
  }

  function choose(bank: Bank) {
    setSelected(bank);
    setQuery(bank.name);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(0);
        return;
      }
      setActiveIndex((current) => {
        const next = event.key === "ArrowDown" ? current + 1 : current - 1;
        if (next < 0) return matches.length - 1;
        if (next >= matches.length) return 0;
        return next;
      });
      return;
    }
    if (event.key === "Enter" && open && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex]);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label htmlFor={id} className={t.label}>
        {label}
      </label>

      {/* The only thing submitted is the code. The name is never sent: the
          backend rejects an ambiguous one, and we already know the exact code. */}
      <input type="hidden" name={name} value={selected?.code ?? ""} />

      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[activeIndex] ? `${id}-opt-${activeIndex}` : undefined}
          autoComplete="off"
          required={required && selected === null}
          placeholder="Start typing your bank"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={`${t.field} pr-10`}
        />

        {selected ? (
          <button
            type="button"
            aria-label="Clear selected bank"
            onClick={() => {
              setSelected(null);
              setQuery("");
              setOpen(true);
            }}
            className={`absolute inset-y-0 right-0 flex w-10 items-center justify-center ${t.clear}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>

      {open ? (
        <ul ref={listRef} id={listId} role="listbox" aria-label="Banks" className={t.list}>
          {matches.length === 0 ? (
            <li className={`${t.option} cursor-default opacity-70`}>
              No bank matches “{query}”.
            </li>
          ) : (
            matches.map((bank, index) => (
              <li
                key={bank.code}
                id={`${id}-opt-${index}`}
                data-index={index}
                role="option"
                aria-selected={selected?.code === bank.code}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  // mousedown, not click: the input's blur would close the list first.
                  event.preventDefault();
                  choose(bank);
                }}
                className={`${t.option} ${index === activeIndex ? t.optionActive : ""}`}
              >
                {bank.name}
              </li>
            ))
          )}
        </ul>
      ) : null}

      <p className={t.hint}>
        {selected
          ? `${selected.name} selected.`
          : "Pick your bank from the list — we'll handle the rest."}
      </p>
    </div>
  );
}
