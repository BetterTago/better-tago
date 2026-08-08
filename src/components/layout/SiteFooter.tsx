import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/ui/Container';
import { lguConfig } from '@/lib/lgu-config';
import { PORTAL_VERSION } from '@/lib/version';

/**
 * The independence statement is not a footer nicety — it is the reason a
 * resident can trust what they are reading. It renders on every page, in the
 * page's own language, and it is the one thing here that is not configurable.
 */
export async function SiteFooter() {
  const t = await getTranslations('footer');
  const { network } = lguConfig.portal;
  const { correctionChannel } = lguConfig.contact.project;

  return (
    <footer className="mt-16 border-t border-line bg-surface-raised py-8">
      <Container className="flex flex-col gap-3 text-sm text-ink-secondary">
        <p className="max-w-prose font-medium text-ink">{t('independence')}</p>
        <p className="max-w-prose">{t('sourceNote')}</p>
        <p className="flex flex-wrap items-center gap-x-4">
          {/* Standalone in a flex row rather than inline in a sentence, so the
              WCAG 2.5.8 inline exception does not apply to it — it gets a real
              44px target like every other control. */}
          {/* The correction path is a commitment this project made to the
              municipality before it published anything — corrections fixed
              first, discussed after — and a commitment nobody can find is not
              one. It renders first in the row for that reason. Null-guarded
              because the channel is a config value: no channel means no dead
              link, never a hardcoded fallback. */}
          {correctionChannel && (
            <a
              href={correctionChannel}
              rel="noopener noreferrer"
              target="_blank"
              className="inline-flex min-h-11 items-center text-ink-link hover:text-ink-link-hover"
            >
              {t('corrections')}
            </a>
          )}
          <a
            href={network.url}
            rel="noopener noreferrer"
            target="_blank"
            className="inline-flex min-h-11 items-center text-ink-link hover:text-ink-link-hover"
          >
            {t('networkLabel', { network: network.name })}
          </a>
          <span>{t('versionLabel', { version: PORTAL_VERSION })}</span>
        </p>
      </Container>
    </footer>
  );
}
