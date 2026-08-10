/**
 * The one wayfinding-rail item, so three rails cannot drift into three.
 *
 * The categories rail on the index, the "On this page" rail on a service, and
 * the "Narrow by category" facets on search are the same control doing the same
 * job in the same 240px column. They looked alike until one of them was touched;
 * the classes live here so that stops being a thing anybody has to remember.
 *
 * The three states are separate exports rather than one function with a boolean,
 * because `CURRENT` is applied to a `<span>` and `LINK` to a `<Link>` — the
 * current item is never a link, and a single call site taking `isCurrent` would
 * invite rendering both as anchors.
 */

/** Geometry and type, shared by every state. */
export const RAIL_ITEM =
  'flex items-center justify-between gap-2 -ml-2.5 py-2.5 pr-2.5 pl-2.5 text-sm';

/**
 * The item for the page — or the section — the reader is on.
 *
 * Always paired with `aria-current`: the tint and the 4px rule are the second
 * signal, never the only one.
 */
export const RAIL_ITEM_CURRENT =
  'rail-mark-current bg-surface-tint font-semibold text-ink';

/** Everything else. The rule appears on hover, in the quieter line colour. */
export const RAIL_ITEM_LINK =
  'text-ink-secondary hover:rail-mark-hover hover:bg-surface-tint hover:text-ink-link';
