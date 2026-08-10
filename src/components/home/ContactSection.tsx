import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Logo } from '@/components/ui/Logo';
import { Section } from '@/components/ui/Section';
import { CALENDAR_DATE, calendarDate } from '@/lib/dates';
import { lguConfig } from '@/lib/lgu-config';
import { telHref } from '@/lib/tel';
import { ContactCard } from './ContactCard';

/**
 * How to reach the municipality — not this project.
 *
 * Cards and mark ported from BetterTandag's `ContactSection` (2026-08-10, by
 * instruction) — the whole-card-as-link mechanic, the icon-tile layout, and
 * the `contact-mark` silhouette sizing/position are the same; the content,
 * palette and gradient stops are this portal's own.
 *
 * All three cards below are real, live values today: phone and email are
 * published on the municipality's own contact page, and the address links a
 * Google Maps pin confirmed, by instruction, to resolve to a place named
 * "Tago Municipal Hall" at coordinates consistent with the municipality's
 * already-recorded centroid — not a guessed pin.
 *
 * `contact.municipalHall.officeHours` is still `null` in the configuration,
 * with its `pending` entry unchanged and still listed on `/gaps`. This
 * section stopped RENDERING that gap on 2026-08-10, by instruction — the
 * underlying fact is unaffected, and the register is still the honest,
 * complete account of it.
 */
export async function ContactSection() {
  const [t, tHome, tCommon, format] = await Promise.all([
    getTranslations('contact'),
    getTranslations('home'),
    getTranslations('common'),
    getFormatter(),
  ]);

  const { municipalHall } = lguConfig.contact;

  return (
    <div
      data-surface="inverse"
      className="relative mt-14 overflow-hidden bg-surface-inverse text-ink sm:mt-16"
    >
      <div aria-hidden="true" className="slab-glow absolute inset-0" />
      {/* Cropped silhouette. `Logo` is `aria-hidden` by construction and the
          utility adds `pointer-events-none` — texture, not content. It needs
          no colour of its own: this ground is `data-surface="inverse"`,
          where the mark's role tokens already resolve to white, so the
          three-tone emblem flattens to one shape on its own. */}
      <Logo idPrefix="contact-mark" className="contact-mark opacity-5" />

      <div className="relative">
        <Section
          id="contact"
          eyebrow={tHome('eyebrowContact')}
          heading={t('heading', { municipality: lguConfig.lgu.officialName })}
          className="page-measure py-14 sm:py-16"
          intro={
            // Full width — no `max-w-prose`, no border box. Every section
            // intro on this page is full width as of 2026-08-10, by
            // instruction; this one led. The link back to the source page
            // stays: a reader still deserves the means to verify it.
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
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-2 text-ink-link hover:text-ink-link-hover"
                >
                  {t('openContactPage')}
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                  />
                </a>
              )}
            </p>
          }
        >
          <ul className="grid gap-4 sm:grid-cols-3">
            {municipalHall.phone && (
              <li>
                <ContactCard
                  icon={Phone}
                  label={t('phoneLabel')}
                  value={municipalHall.phone}
                  note={municipalHall.office ?? undefined}
                  href={telHref(municipalHall.phone)}
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
              />
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
