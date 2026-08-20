'use client';

import { useEffect, useRef } from 'react';
/*
 * Static, while the LIBRARY below is dynamic — and the split is deliberate.
 *
 * A dynamic `import()` of a stylesheet is not reliably injected by the bundler,
 * and the failure is not obvious: without Leaflet's CSS the tiles stack
 * vertically instead of tiling, which reads as a broken image rather than a
 * missing style. Statically imported from a Client Component, Next emits it as
 * this component's own chunk, so the ~380 routes that render no map never load
 * it.
 */
import 'leaflet/dist/leaflet.css';

/**
 * The municipal hall on a map. `TAGO-117`.
 *
 * 🔴 **This is the first third-party request this portal makes from a reader's
 * browser, and that is the significant fact about it — not the map.**
 *
 * Until now every byte a reader fetched came from this origin: the content is
 * files, the config is a file, and the weather call happens on the server. A
 * tile layer changes that. `tile.openstreetmap.org` learns each reader's IP
 * address and, from the tile coordinates, roughly what they were looking at.
 *
 * Two things follow, and neither is optional:
 *
 * · **The panel says so, in the reader's own language**, next to the map rather
 *   than in a policy nobody opens. `LocalConditions` renders `map.tileNotice`.
 * · **Leaflet comes from the lockfile, never a CDN.** The reference portal
 *   loads it from `unpkg.com`; doing the same here would breach `TAGO-110`
 *   criterion 5 — *no external script* — which survived the 2026-08-20
 *   amendment untouched. Importing the npm package is what keeps the only
 *   third-party origin on this page the tile server, rather than two.
 *
 * ## Loaded on demand, not in the page bundle
 *
 * Leaflet is ~45 kB gzipped and is useless to a reader who never scrolls this
 * far. The dynamic `import()` inside the effect keeps it out of the initial
 * bundle for every route — including the ~380 that do not render a map at all.
 *
 * ## What it does when JavaScript never runs
 *
 * Nothing, and that is handled a level up. This component renders an empty
 * container; `LocalConditions` puts the address and the directions link
 * *outside* it, so a reader with scripting off gets the two things that
 * actually answer "where is the hall" and no broken frame. `next/dynamic` with
 * `ssr: false` is deliberately NOT used — it would render a placeholder that
 * says nothing.
 *
 * ## No hazard layer. Not now, not later.
 *
 * `TAGO-117`'s last criterion. Flood, evacuation, storm track — those belong to
 * the national weather service and the municipal disaster office. A hazard
 * layer rendered here would be a far more consequential misreading than the
 * conditions card could ever cause.
 */

/** Zoom that frames the poblacion — close enough to place the hall on a street. */
const ZOOM = 15;

export function HallMap({
  latitude,
  longitude,
  label,
}: {
  latitude: number;
  longitude: number;
  /** Accessible name and marker title. Comes from the message catalogue. */
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = container.current;
    if (!node) return;

    let cancelled = false;
    // Typed as the Leaflet map instance without importing the type eagerly —
    // `import type` would pull the module into the graph we are deferring.
    let map: { remove: () => void } | null = null;

    void (async () => {
      const leaflet = await import('leaflet');
      if (cancelled || !container.current) return;

      const L = leaflet.default;

      const instance = L.map(node, {
        center: [latitude, longitude],
        zoom: ZOOM,
        // The page scrolls; a map that eats the wheel traps a reader mid-page.
        // Zoom stays available through the buttons and the keyboard.
        scrollWheelZoom: false,
        attributionControl: true,
        keyboard: true,
      });

      /*
       * Attribution is a licence obligation under ODbL, not a courtesy, and it
       * is passed to the layer rather than added separately so it cannot be
       * removed by styling the control away without also removing the tiles.
       */
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(instance);

      /*
       * A plain circle marker rather than Leaflet's default pin image. The pin
       * is a PNG the library resolves by URL, which breaks under a bundler
       * without extra configuration — and a vector marker needs no asset, scales
       * cleanly, and takes its colour from the token layer via a class.
       */
      L.circleMarker([latitude, longitude], {
        radius: 9,
        weight: 3,
        className: 'hall-marker',
      })
        .addTo(instance)
        .bindTooltip(label, { permanent: false, direction: 'top' });

      map = instance;
    })();

    return () => {
      cancelled = true;
      // Leaflet keeps listeners on window; without this a locale switch leaves
      // a detached map instance behind and the next mount throws "already
      // initialized" on the same container.
      map?.remove();
    };
  }, [latitude, longitude, label]);

  return (
    <div
      ref={container}
      /*
       * `role="region"` with a name, NOT `role="application"`.
       *
       * `application` is the conventional choice for a map and it is the wrong
       * one here: it tells a screen reader to hand every keystroke to the
       * widget, which costs the reader their own navigation commands in
       * exchange for pan controls most will never use. A named region is a
       * landmark they can skip, and Leaflet's keyboard handling still works for
       * anyone who focuses it.
       */
      role="region"
      aria-label={label}
      tabIndex={0}
      className="h-72 w-full rounded-lg border border-line bg-surface-sunken sm:h-full sm:min-h-80"
    />
  );
}
