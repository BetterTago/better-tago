'use client';

import { X } from 'lucide-react';
import { useRef, useState, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'bt-advisory-dismissed';

/** Also fires when another tab dismisses the same advisory. */
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function readDismissedId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private-browsing modes throw on read. Showing the advisory is the safe
    // failure here — a missed dismissal costs an extra click, a missed advisory
    // could cost more than that.
    return null;
  }
}

/** The server has no localStorage, so it always renders the bar. */
function serverSnapshot(): string | null {
  return null;
}

/**
 * The advisory bar.
 *
 * **Absent entirely when no advisory is published**, which is the state today.
 * A permanent specimen bar is worse than none: a bar that is always there
 * teaches people to ignore the one that matters.
 *
 * ## Dismissal is against the advisory's ID, never a boolean
 *
 * A boolean would let a NEW advisory inherit the previous dismissal, so a real
 * storm notice would never appear for anyone who had dismissed anything before
 * it. Persisting the id costs nothing and cannot fail that way.
 *
 * Client-rendered because that comparison cannot be made in CSS before paint.
 * It is server-rendered first and hidden on mount, so a reader who has not
 * dismissed it sees it with no delay. All copy arrives as props — no i18n
 * runtime in this bundle.
 */
export function AdvisoryBar({
  advisoryId,
  body,
  regionLabel,
  badgeLabel,
  dismissLabel,
}: {
  advisoryId: string;
  body: string;
  regionLabel: string;
  badgeLabel: string;
  dismissLabel: string;
}) {
  const [dismissedNow, setDismissedNow] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Read through the store rather than in an effect: an effect that calls
  // setState on mount triggers a cascading render, and this way a dismissal in
  // another tab is picked up too.
  const storedId = useSyncExternalStore(
    subscribe,
    readDismissedId,
    serverSnapshot
  );
  const dismissed = dismissedNow || storedId === advisoryId;

  function dismiss() {
    // Move focus on BEFORE unmounting, or the keyboard reader drops to <body>
    // and loses their place entirely.
    const next = barRef.current?.nextElementSibling;
    next?.querySelector<HTMLElement>('a, button')?.focus();

    try {
      localStorage.setItem(STORAGE_KEY, advisoryId);
    } catch {
      // Dismissal still applies to this view; it just will not persist.
    }
    setDismissedNow(true);
  }

  if (dismissed) return null;

  return (
    <div
      ref={barRef}
      data-surface="accent"
      role="region"
      aria-label={regionLabel}
      className="bg-accent-400 text-ink motion-safe:animate-drop-in"
    >
      <div className="page-measure flex flex-wrap items-start gap-x-3 gap-y-2 py-2 text-sm">
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-surface-control px-2.5 py-0.5 text-2xs font-semibold tracking-caps uppercase">
          {/* Decorative. The advisory's meaning is in its text — a pulsing dot
              is colour and motion, which is no channel at all for some readers. */}
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-ink motion-safe:animate-pulse-dot"
          />
          {badgeLabel}
        </span>
        <p className="min-w-0 basis-full font-medium sm:flex-1 sm:basis-auto">
          {body}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="-me-2 ms-auto grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface-control"
        >
          <X aria-hidden="true" className="size-4" />
          <span className="sr-only">{dismissLabel}</span>
        </button>
      </div>
    </div>
  );
}
