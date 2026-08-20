'use client';

import { useEffect } from 'react';

/**
 * Fires the visit count, once per browser per 24 hours. `TAGO-116`.
 *
 * ## Why this is a client leaf, and why it renders nothing
 *
 * It renders **no markup at all** — the number itself is server-rendered by
 * `SiteFooter`, which reads the store directly. This exists only to perform the
 * write, which needs two things a server render cannot supply on a prerendered
 * route: the knowledge that a real browser just loaded the page, and the
 * reader's own 24-hour marker.
 *
 * Keeping the figure on the server is deliberate. A client-rendered count would
 * flash, would need a loading state this codebase does not have, and would let
 * a number that is not true exist on screen for a frame — which `CountUp.tsx`
 * was written specifically to prevent.
 *
 * ## 🔒 The deduplication is the reader's, not ours
 *
 * The 24-hour marker lives in **their** `localStorage` and never leaves the
 * browser. The server stores no identifier of any kind — no IP, no hash, no
 * cookie — so it cannot deduplicate and does not try. That asymmetry is the
 * whole privacy design: the only thing that distinguishes one reader from
 * another is a timestamp on their own machine, which they can clear.
 *
 * Two consequences, both accepted:
 *
 * · a private-browsing session is counted again every time, because the marker
 *   cannot persist;
 * · clearing site data makes a returning reader look new.
 *
 * ## Every storage access is wrapped, and a throw counts
 *
 * `localStorage` **throws outright** in some private-browsing modes rather than
 * returning null — the same hazard `src/lib/theme-init.ts` documents and guards
 * against. On a throw this falls through and counts: over-counting a session
 * nobody can identify is a better failure than a component that breaks a
 * footer.
 */

const STORAGE_KEY = 'bettertago-counted';
const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Reads the marker. A throw, a missing value, or junk all mean "not counted". */
function countedRecently(now: number): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    const last = Number(stored);
    // `Number('')` is 0 and `Number('nonsense')` is NaN — both must read as
    // "not counted" rather than as a timestamp at the epoch.
    if (!Number.isFinite(last) || last <= 0) return false;

    /*
     * Strictly less than, so the boundary belongs to the NEXT window: a reader
     * returning at exactly 24 hours is counted again. A clock that has moved
     * backwards (a corrected device time, a timezone change) gives a negative
     * elapsed value, which is also not inside the window and also counts —
     * deliberately, because the alternative is a browser that can never be
     * counted again until its clock catches up.
     */
    return now - last < WINDOW_MS && now - last >= 0;
  } catch {
    return false;
  }
}

export function VisitCount() {
  useEffect(() => {
    const now = Date.now();
    if (countedRecently(now)) return;

    /*
     * Written BEFORE the request, not after it. If the write is what fails, the
     * reader is not counted this visit — one missing increment on a decorative
     * figure. If the ORDER were reversed and the request succeeded while the
     * marker failed to persist, every navigation in the session would count
     * again, which is a far worse distortion than a lost one.
     */
    try {
      window.localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // Private browsing. Fall through and count anyway.
    }

    /*
     * Fire and forget, hard-timed, and rejection swallowed. Nothing on the page
     * waits for this and nothing on the page changes when it fails — the count
     * a reader sees was rendered by the server before this ran, and their own
     * visit is in the next render's figure, not this one.
     */
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 2000);

    void fetch('/api/visits', {
      method: 'POST',
      signal: abort.signal,
      // Same-origin explicitly: the handler refuses anything else, and saying
      // so here means a misconfiguration fails at the fetch rather than quietly
      // sending a request that is always going to be discarded.
      credentials: 'omit',
      cache: 'no-store',
    })
      .catch(() => {})
      .finally(() => clearTimeout(timer));

    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, []);

  return null;
}

/** The storage key, so a test can assert the window without re-declaring it. */
export const VISIT_STORAGE_KEY = STORAGE_KEY;
/** The deduplication window in milliseconds, for the same reason. */
export const VISIT_WINDOW_MS = WINDOW_MS;
