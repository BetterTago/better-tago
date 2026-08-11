import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { CALENDAR_DATE, calendarDate } from '@/lib/dates';
import { lguConfig } from '@/lib/lgu-config';
import { telHref } from '@/lib/tel';
import { ContactCard } from './ContactCard';

/**
 * How to reach the municipality — not this project. The BODY of the contact
 * surface, with no frame of its own.
 *
 * ## Why it is a component and not a section
 *
 * It renders in two places: inside `ContactSection` on the home page's dark
 * slab, and inside `/contact`, which is the same three cards under a masthead.
 * A phone number that is right on one page and stale on the other is worse than
 * one that is absent from both, so the frame is what differs and the directory
 * is shared.
 *
 * 🔴 **It sets no ground and no measure**, deliberately — every colour is a
 * ROLE token, so the same markup is correct on the home page's
 * `data-surface="inverse"` slab and on `/contact`'s ordinary page surface
 * without a conditional.
 *
 * All three cards are real, live values today: phone and email are published on
 * the municipality's own contact page, and the address links a Google Maps pin
 * confirmed, by instruction, to resolve to a place named "Tago Municipal Hall"
 * at coordinates consistent with the municipality's already-recorded centroid —
 * not a guessed pin.
 *
 * `contact.municipalHall.officeHours` is still `null` in the configuration,
 * with its `pending` entry unchanged and still listed on `/gaps`. This surface
 * stopped RENDERING that gap on 2026-08-10, by instruction — the underlying
 * fact is unaffected, and the register is still the honest, complete account
 * of it.
 */
export async function ContactDirectory({
  headingLevel = 3,
}: {
  /**
   * The level for each card's label. `3` under the home page's section `h2`,
   * `2` on `/contact`, where the section's title has moved up to the masthead's
   * `h1` and there is no `h2` between the two. See `EmergencyDirectory` for the
   * reasoning — a heading level is a fact about where a component sits.
   */
  headingLevel?: 2 | 3;
} = {}) {
  const [t, tCommon, format] = await Promise.all([
    getTranslations('contact'),
    getTranslations('common'),
    getFormatter(),
  ]);

  const { municipalHall } = lguConfig.contact;

  return (
    <>
      {/*
        🔴 The provenance sits ABOVE the values it vouches for, for the same
        reason the emergency callout does: a reader deciding whether to trust a
        phone number needs to know where it came from BEFORE they dial it. Full
        width — no `max-w-prose`, no border box. The link back to the source page
        stays: a reader deserves the means to verify it rather than this page's
        word for it.
      */}
      <p className="mb-6 leading-relaxed text-ink-secondary">
        {t('provenance', {
          date: format.dateTime(
            calendarDate(municipalHall.source.checkedAt),
            CALENDAR_DATE
          ),
        })}{' '}
        {municipalHall.source.url && (
          <a
            href={municipalHall.source.url}
            rel="noopener noreferrer"
            target="_blank"
            className="inline-flex items-center gap-1 underline underline-offset-2 text-ink-link hover:text-ink-link-hover"
          >
            {t('openContactPage')}
            <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="sr-only">({tCommon('opensExternalSite')})</span>
          </a>
        )}
      </p>

      <ul className="grid gap-4 sm:grid-cols-3">
        {municipalHall.phone && (
          <li>
            <ContactCard
              icon={Phone}
              label={t('phoneLabel')}
              value={municipalHall.phone}
              note={municipalHall.office ?? undefined}
              href={telHref(municipalHall.phone)}
              headingLevel={headingLevel}
            />
          </li>
        )}

        {municipalHall.email && (
          <li>
            <ContactCard
              icon={Mail}
              label={t('emailLabel')}
              value={municipalHall.email}
              note={municipalHall.office ?? undefined}
              href={`mailto:${municipalHall.email}`}
              headingLevel={headingLevel}
            />
          </li>
        )}

        <li>
          <ContactCard
            icon={MapPin}
            label={t('addressLabel')}
            value={municipalHall.address}
            note={`${municipalHall.name} · ${t('addressNote')}`}
            href={municipalHall.mapUrl}
            external
            externalLabel={tCommon('opensExternalSite')}
            headingLevel={headingLevel}
          />
        </li>
      </ul>
    </>
  );
}
