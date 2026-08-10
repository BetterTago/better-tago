import { TriangleAlert } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { TickerViewport } from '@/components/layout/TickerViewport';
import { lguConfig } from '@/lib/lgu-config';
import { telHref } from '@/lib/tel';
import { cn } from '@/lib/utils';

/**
 * One dialable entry. A real `tel:` link in BOTH runs.
 *
 * 🔴 **The echo's numbers are links too, and that is a fix rather than a
 * detail.** The echo first shipped as inert `<span>`s — visually identical, so
 * the loop looked right, and completely dead to a pointer. Half of every cycle
 * put unclickable copies of emergency numbers under the reader's finger, and
 * nothing about them looked any different. Reported from the running site, not
 * caught here, which is why the test now walks BOTH runs.
 *
 * What the echo drops instead is its presence in the accessibility tree and in
 * the tab order — `aria-hidden` on the run, `tabIndex={-1}` on each link — so
 * no number is announced twice and no number is a second tab stop. That pairing
 * is also what keeps `aria-hidden-focus` passing: the rule fails on focusable
 * content inside a hidden subtree, and `-1` is exactly the escape it specifies.
 *
 * Hoisted to module scope rather than closed over `echo` inside `TickerRun` —
 * a component declared during render is a new type every pass, which throws
 * away the subtree's state and is a lint error in its own right.
 */
function Entry({
  echo,
  href,
  ariaLabel,
  children,
}: {
  echo: boolean;
  href: string;
  ariaLabel?: string;
  children: string;
}) {
  return (
    <a
      href={href}
      // The echo's copy is a duplicate of something the accessibility tree
      // already has, so it is silent and unreachable by Tab — but a pointer
      // still finds it, which is the entire point.
      aria-label={echo ? undefined : ariaLabel}
      tabIndex={echo ? -1 : undefined}
      className={cn(
        ENTRY_CLASS,
        // Underline is not available site-wide, so the feedback has to move: a
        // washed ground plus the number brightening. Both pairs stay above
        // 4.5:1 ON the washed ground, so hovering never costs legibility.
        //
        // `outline-offset-0`: the bar is 28px and the base focus ring sits 2px
        // outside the box with a further 2px offset, which the viewport's
        // overflow would clip.
        'text-error-200 tabular-nums hover:bg-error-700 hover:text-error-100 focus-visible:outline-offset-0 motion-safe:transition-colors motion-safe:duration-150'
      )}
    >
      {children}
    </a>
  );
}

/** One entry of the configuration's `emergency.municipalHotlines` array. */
type MunicipalHotline =
  (typeof lguConfig)['emergency']['municipalHotlines'][number];

/** Shared by the run and its echo, so the two measure identically. */
const ENTRY_CLASS = 'inline-flex items-center rounded-sm px-1';

/**
 * The emergency bar, above the header.
 *
 * 🔴 **BetterTago has no municipal hotline, and this bar says so.**
 *
 * `emergency.municipalHotlines` is `[]` and `emergency.status` is
 * `not-obtained`. Four sources were swept for a Tago number and all four came
 * back empty or unretrievable; every sweep is recorded in the configuration
 * with its date. So the bar carries exactly two things — the NATIONAL line,
 * which is real and dialable, and one clause stating that no municipal number
 * has been published, linking the section that explains it.
 *
 * It renders **no municipal number while `emergency.status` is
 * `not-obtained`**, and it will never carry a neighbouring municipality's
 * number, a provincial office's, or a plausible guess. A wrong number in an
 * emergency is worse than no number at all, and that is a settled position
 * rather than a temporary state.
 *
 * ## It moves, AND every number stays dialable
 *
 * Both, deliberately — the marquee is what makes six agencies fit in a 28px
 * strip, and a hotline you cannot tap is not a hotline. Four things reconcile
 * them, and none may be dropped:
 *
 * · **hover** pauses it, so a mouse travelling toward the bar has already
 *   stopped it before it arrives;
 * · **`:focus-within`** pauses it, so Tab lands on a number that then holds
 *   still — and both of those are plain CSS, so neither waits on hydration;
 * · **touch and drag** pause it through `TickerViewport`, which also swaps the
 *   row back to a real scroller so it can be swiped by hand;
 * · every number is ALSO in `#emergency` at full size, which is where anybody
 *   actually dialling in a storm should be.
 *
 * It runs only when one run genuinely overflows — measured, never guessed from
 * a breakpoint — and with JavaScript off it never starts at all, leaving the
 * static scrollable row that is the correct floor for an enhancement whose
 * whole job is to move.
 *
 * ## Accessibility
 *
 * · The bar is 28px, so its targets are under the 44px floor. Deliberate, and
 *   listed in the e2e exemption list rather than left invisible — every number
 *   here is also in `#emergency` at full size.
 * · The echo run is `aria-hidden` and its links are `tabIndex={-1}`, so the
 *   loop is seamless without announcing a number twice or adding a second tab
 *   stop — while every visible number, in either run, stays dialable by
 *   pointer.
 */
export async function HotlineTicker({
  /*
   * Defaulted from the configuration rather than read inside, so the populated
   * state is reachable from a test fixture. The component that renders the most
   * consequential thing on the page must be provable at full density — a dozen
   * hotlines, a long organisation name, both locales — long before real numbers
   * arrive, and a component that reads module state can only ever be tested in
   * the one state that module happens to be in. See docs: gaps are the shipping
   * state, populated is the tested one.
   */
  emergency = lguConfig.emergency,
}: {
  emergency?: (typeof lguConfig)['emergency'];
} = {}) {
  const [t, tEmergency] = await Promise.all([
    getTranslations('ticker'),
    getTranslations('emergency'),
  ]);

  const { nationalLine, status } = emergency;
  const municipal = emergency.municipalHotlines;

  /*
   * The guard is on the STATUS, not just on the array being empty.
   *
   * `partial` or `requested` with a stale array is exactly the state in which a
   * half-obtained number could leak onto the page, so nothing municipal renders
   * until the status itself says the numbers are obtained.
   */
  const municipalReady = status === 'obtained' && municipal.length > 0;

  return (
    <section
      // `data-surface="inverse"` for one role: `--focus-ring` resolves to a
      // white there, which is legible on this maroon. The ink colours are
      // explicit `error` steps rather than the scope's greens, and every pair
      // is measured against `error-950` in theme-tokens.test.ts.
      data-surface="inverse"
      role="region"
      aria-label={t('regionLabel')}
      className="border-b border-error-800 bg-error-950"
    >
      {/* No `justify-*` utility here: `.hotline-viewport` sets `safe center` in
          globals.css for the static state, and a utility would beat it and put
          the overflow back out of reach. */}
      <TickerViewport className="flex h-7 items-center">
        <div className="hotline-track">
          <TickerRun
            label={t('label')}
            nationalLabel={tEmergency('nationalLine')}
            nationalLine={nationalLine}
            hotlines={municipalReady ? municipal : []}
            callLabel={(organisation, number) =>
              tEmergency('callAria', { organisation, number })
            }
            gapClause={municipalReady ? null : t('municipalGap')}
          />
          {/*
            The echo, so the loop has no visible seam. Shown only by
            `[data-marquee='true']`, so the static row never pays for it.

            🔴 Its numbers are REAL, clickable `tel:` links. They were inert
            spans for one revision, which meant half of every cycle showed
            emergency numbers that could not be dialled and looked no different
            from the ones that could. What the echo drops is its voice and its
            tab stops, never its function — see `Entry`.
          */}
          <TickerRun
            echo
            label={t('label')}
            nationalLabel={tEmergency('nationalLine')}
            nationalLine={nationalLine}
            hotlines={municipalReady ? municipal : []}
            gapClause={municipalReady ? null : t('municipalGap')}
          />
        </div>
      </TickerViewport>
    </section>
  );
}

/**
 * One pass of the line.
 *
 * `echo` renders the SAME markup with the same links — it only leaves the
 * accessibility tree and the tab order (see `Entry`). The two runs share
 * `.hotline-run` and identical copy, so they measure the same and the
 * animation's `-50%` steps exactly one of them.
 */
function TickerRun({
  echo = false,
  label,
  nationalLabel,
  nationalLine,
  hotlines,
  callLabel,
  gapClause,
}: {
  echo?: boolean;
  label: string;
  nationalLabel: string;
  nationalLine: string;
  hotlines: MunicipalHotline[];
  callLabel?: (organisation: string, number: string) => string;
  gapClause: string | null;
}) {
  return (
    <div
      aria-hidden={echo || undefined}
      className={cn('hotline-run text-2xs', echo && 'hotline-echo')}
    >
      <span className="flex shrink-0 items-center gap-1.5 font-bold tracking-caps text-error-400 uppercase">
        <TriangleAlert aria-hidden="true" className="size-3 shrink-0" />
        {label}
      </span>

      <span className="flex shrink-0 items-center gap-1">
        <span className="shrink-0 font-bold text-ink">{nationalLabel}</span>
        <Entry
          echo={echo}
          href={telHref(nationalLine)}
          ariaLabel={callLabel?.(nationalLabel, nationalLine)}
        >
          {nationalLine}
        </Entry>
      </span>

      {/* Obtained municipal numbers, each under the office that supplied it.
          `·` separates organisations and is decorative — a screen reader gets
          the office and the number from each link's own accessible name, and
          punctuation read aloud between them is noise. */}
      {hotlines.map(hotline => (
        <span key={hotline.label} className="flex shrink-0 items-center gap-1">
          <span aria-hidden="true" className="px-1.5 text-error-600">
            ·
          </span>
          <span className="shrink-0 font-bold text-ink">{hotline.label}</span>
          {/* An agency's own numbers are joined by `|`, which is decorative —
              a screen reader gets the agency and the number from each link's
              accessible name, and punctuation read aloud between them is
              noise. */}
          {hotline.numbers.map((number, index) => (
            <span key={number} className="flex shrink-0 items-center gap-1">
              {index > 0 && (
                <span aria-hidden="true" className="text-error-600">
                  |
                </span>
              )}
              <Entry
                echo={echo}
                href={telHref(number)}
                ariaLabel={callLabel?.(hotline.label, number)}
              >
                {number}
              </Entry>
            </span>
          ))}
        </span>
      ))}

      {/* The gap, in the bar itself rather than only in the section below. A
          reader who never scrolls still learns that the municipal number is
          missing rather than assuming the national line is all there is. */}
      {gapClause !== null && (
        <span className="flex shrink-0 items-center gap-1">
          <span aria-hidden="true" className="px-1.5 text-error-600">
            ·
          </span>
          <Entry echo={echo} href="#emergency">
            {gapClause}
          </Entry>
        </span>
      )}
    </div>
  );
}
