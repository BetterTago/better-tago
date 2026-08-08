import { cn } from '@/lib/utils';

/**
 * The BetterTago mark: a swayed eight-point sun around a three-part green
 * emblem.
 *
 * See brand/logo/README.md for the standalone SVGs and the construction notes.
 * Eight points of three rays each, DERIVED from the Philippine flag sun and
 * redrawn: every ray is bent along a curve and leans the same rotational
 * direction, and the whole set is turned 20° clockwise, so the sun reads as
 * swaying behind a turn. The emblem turns with it. It is flag-derived, not
 * flag-official — do not describe it as the latter.
 *
 * ## Why this is inlined rather than an <img src="/logo.svg">
 *
 * The mark ships three files — colour, black and reversed-white — that differ
 * only in their four fills. Inlined, those fills come from named theme tokens,
 * so ONE component can render every variant without a second import, and the
 * mark cannot smuggle a colour literal past the guardrail scan.
 *
 * ## Three things that are load-bearing
 *
 * `idPrefix` is required: two masks, a clip path and both <use> chains need
 * document-unique ids, and a Server Component cannot call useId(). Two
 * instances sharing a prefix would break the second one's masks.
 *
 * The masks' black and white are LUMINANCE, not colour — white keeps, black
 * cuts. They are keywords rather than tokens on purpose: theming them would
 * punch a hole in the sun or fill in the emblem's channels.
 *
 * The two `rotate(20)` values must stay in step. The sun and the emblem are
 * separate groups because only one of them is masked, but they are one artwork
 * — turning either alone twists the channels out of the rays' rhythm.
 *
 * Always `aria-hidden` — the wordmark sits beside it everywhere it appears, and
 * naming the SVG would make the header link announce "BetterTago BetterTago".
 *
 * Minimum legible size is 32px (the design sheet's own floor; it marks 20px as
 * too small). The header renders it at 36.
 */

/**
 * The delivered framing, kept verbatim.
 *
 * Measured by rasterising and scanning painted pixels, the artwork occupies
 * `43.63 -0.37 112.75 112.75` — square, centred on the sun's own origin, with
 * 0.63 units of air inside the declared box. A 0.55% margin is not worth a
 * second set of numbers to keep in sync, so the component and the archived SVGs
 * frame the mark identically and `Logo.test.tsx` asserts they agree.
 *
 * Do NOT measure this with `getBoundingClientRect()` on the ray `<use>`
 * elements. For a rotated reference it takes the referenced content's
 * axis-aligned box FIRST and then transforms that rectangle, which inflates
 * eight rays at 45° spacing to 119.79 — a 6% overstatement that reads exactly
 * like the mark overflowing its own viewBox.
 */
const VIEW_BOX = '43 -1 114 114';

/** Eight points, evenly spaced. The 20° sway is applied to the group, not here. */
const POINTS = [0, 45, 90, 135, 180, 225, 270, 315];

export function Logo({
  idPrefix,
  size = 36,
  className,
}: {
  idPrefix: string;
  /** The mark's width and height in px. The artwork is square. */
  size?: number;
  className?: string;
}) {
  const slimId = `${idPrefix}-slim`;
  const pointId = `${idPrefix}-point`;
  const discClipId = `${idPrefix}-disc-clip`;
  const discGapId = `${idPrefix}-disc-gap`;
  const rayCutId = `${idPrefix}-ray-cut`;

  return (
    <svg
      viewBox={VIEW_BOX}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn('block shrink-0', className)}
    >
      <defs>
        {/* One point is a broad central ray flanked by two slim ones at ±17°.
            Every ray is bent along a curve and leans the same rotational
            direction, which is what makes the sun read as swaying. */}
        <path
          id={slimId}
          d="M0,0 C-3,-0.1 -7,0.2 -10,0.9 C-12,1.4 -13.6,1.9 -14.4,2.3 L-15.3,3.8 L-14.4,4.3 C-13.4,3.8 -11.8,3.1 -10,2.5 C-7,1.6 -3,0.7 0,0 Z"
        />
        <g id={pointId}>
          <path d="M0,0 C-2,-0.15 -4,-0.2 -6,-0.17 C-9,-0.05 -11,0.35 -12,0.9 C-14.5,1.5 -16.5,2.2 -17.5,2.75 L-18.5,5.0 L-17.5,5.95 C-16.4,5.2 -14.2,4.2 -12,3.3 C-10,2.4 -8,1.7 -6,1.23 C-4,0.8 -2,0.4 0,0 Z" />
          <use href={`#${slimId}`} transform="rotate(-17)" />
          <use href={`#${slimId}`} transform="rotate(17)" />
        </g>

        {/* Holds the three emblem regions to a circle. They are drawn as open
            wedges running past the disc edge, so without this they spill. */}
        <clipPath id={discClipId}>
          <circle r="12" />
        </clipPath>

        {/* The channels. The same two curves that divide the regions, redrawn
            at a 2-unit stroke and painted black, so a gap is cut between them.
            That gap is what keeps the three regions readable when the mark is
            drawn in a single colour — the black and reversed variants, where
            all three fills are identical and the channels are the only thing
            separating them. */}
        <mask
          id={discGapId}
          maskUnits="userSpaceOnUse"
          x="-16"
          y="-16"
          width="32"
          height="32"
        >
          <circle r="12.4" fill="white" />
          <path
            d="M-14,-1.5 C-9,-4.0 -5,1.0 0,-0.5 C3,-1.4 4,-4.5 7,-4.0 C10,-3.5 12,-5.5 14,-6.5"
            fill="none"
            stroke="black"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M2.2,-2.0 C-1.5,0.5 0.5,2.8 2.5,4.8 C4.5,6.8 3.5,9.6 2.5,14"
            fill="none"
            stroke="black"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </mask>

        {/* Stops the rays clear of the disc. Every ray is drawn from the centre
            outward, so all eight overlap in a solid core; this cuts a 30.5-unit
            hole out of it, 4 units clear of the disc's own 26.5-unit edge. */}
        <mask
          id={rayCutId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="-20"
          width="220"
          height="180"
        >
          <rect x="0" y="-20" width="220" height="180" fill="white" />
          <circle cx="100" cy="56" r="30.5" fill="black" />
        </mask>
      </defs>

      <g mask={`url(#${rayCutId})`}>
        <g
          transform="translate(100 56) scale(2.9474) rotate(20)"
          className="fill-mark-sun"
        >
          {POINTS.map(angle => (
            <use
              key={angle}
              href={`#${pointId}`}
              transform={`rotate(${angle})`}
            />
          ))}
        </g>
      </g>

      {/* The emblem. Three regions, light at the top through to deep at the
          lower right, each one a wedge closed against the clip circle. Turned
          into the same 20° rotation as the rays. */}
      <g
        transform="translate(100 56) scale(2.2105) rotate(20)"
        mask={`url(#${discGapId})`}
        clipPath={`url(#${discClipId})`}
      >
        <path
          d="M-14,-1.5 C-9,-4.0 -5,1.0 0,-0.5 C3,-1.4 4,-4.5 7,-4.0 C10,-3.5 12,-5.5 14,-6.5 L14,-16 L-14,-16 Z"
          className="fill-mark-emblem-light"
        />
        <path
          d="M-14,-1.5 C-9,-4.0 -5,1.0 0,-0.5 C0.9,-0.8 1.7,-1.4 2.2,-2.0 C-1.5,0.5 0.5,2.8 2.5,4.8 C4.5,6.8 3.5,9.6 2.5,14 L-14,14 Z"
          className="fill-mark-emblem-mid"
        />
        <path
          d="M2.2,-2.0 C3.2,-2.8 4.8,-4.2 7,-4.0 C10,-3.5 12,-5.5 14,-6.5 L14,14 L2.5,14 C3.5,9.6 4.5,6.8 2.5,4.8 C0.5,2.8 -1.5,0.5 2.2,-2.0 Z"
          className="fill-mark-emblem-deep"
        />
      </g>
    </svg>
  );
}
