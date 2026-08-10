import type { ReactNode } from 'react';
import { Breadcrumb, type Crumb } from '@/components/services/Breadcrumb';

/**
 * The frame every page that is not the landing page opens with.
 *
 * ## A masthead, not a hero
 *
 * The home page has a hero: a full-bleed statement with a glow behind it. A
 * secondary page must not compete with it, so this is a sunken band closed by a
 * hairline, and the title caps at `--text-section` rather than `--text-hero`.
 * The difference is what tells a reader, before reading a word, whether they are
 * at the front door or inside the building.
 *
 * ## Why the provenance slot is part of the frame
 *
 * The right-hand slot carries the source, the check date and the coverage on
 * every page that has them. Putting it in the masthead rather than at the foot
 * of the article is the whole argument of this design: an independent index has
 * to keep making the claim that it is restating a published record, and a claim
 * made below the fold is a claim most readers never meet.
 *
 * 🔴 One component, four routes. No route sets its own masthead — that is
 * TAGO-209 criterion 1, and it exists because four routes styling their own
 * headers is how a portal acquires four visual languages in a fortnight.
 */
export async function PageMasthead({
  trail,
  eyebrow,
  title,
  control,
  lead,
  aside,
}: {
  trail: Crumb[];
  eyebrow?: string;
  title: string;
  /**
   * A control belonging to the page's own subject, between the title and the
   * lead — the search field, and nothing else so far.
   *
   * It sits ABOVE the lead because on the search page the lead describes what
   * the field searches, and a description printed before the thing it describes
   * reads as a preamble to the page rather than as help for the control.
   */
  control?: ReactNode;
  lead?: string;
  /** The provenance / office slot. Rendered below the lead on small screens. */
  aside?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-line bg-surface-sunken">
      {/*
       * Both layers are childless and absolutely positioned. Masking an element
       * masks its DESCENDANTS too, so the ridge can never go on a container —
       * it would clip the masthead's own text.
       *
       * The ridge is the landscape texture and carries in light only; the glow
       * is the same two radial washes the home hero uses, and it is what stops
       * the sunken band reading as a flat grey strip. Together they are the
       * ground the type sits on — never anything the type depends on, which is
       * why both are `aria-hidden` and why every ink role over them is measured
       * against `--surface-sunken` rather than against the wash.
       */}
      <div aria-hidden="true" className="hero-ridge absolute inset-0" />
      <div aria-hidden="true" className="hero-glow absolute inset-0" />

      <div className="page-measure relative pt-7 pb-8 sm:pb-9">
        <Breadcrumb trail={trail} />

        {/*
         * 🔴 A 50/50 split at the desktop breakpoint, not a wide title column
         * beside a narrow panel.
         *
         * The right-hand slot carries the page's provenance — who provides
         * these services, how much of the charter is transcribed, how many
         * results were found. On this portal that is not secondary information
         * squeezed in beside the heading; it is half of what the masthead is
         * for. `grid-cols-2` is `repeat(2, minmax(0, 1fr))`, so a long office
         * name cannot push its column past its half and a long title cannot
         * squeeze it.
         */}
        <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:items-end lg:gap-14">
          <div className="flex flex-col gap-3">
            {eyebrow && (
              <p className="text-2xs font-semibold tracking-label text-ink-tertiary uppercase">
                {eyebrow}
              </p>
            )}
            <h1 className="font-display text-section font-bold text-balance text-ink">
              {title}
            </h1>
            {control}
            {lead && (
              <p className="text-lg leading-relaxed text-pretty text-ink-secondary">
                {lead}
              </p>
            )}
          </div>

          {aside && <div className="min-w-0">{aside}</div>}
        </div>
      </div>
    </div>
  );
}
