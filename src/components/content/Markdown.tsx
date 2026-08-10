import { getTranslations } from 'next-intl/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createSlugger } from '@/lib/markdown-outline';
import { cn } from '@/lib/utils';

/**
 * The text of a table's first header cell, for its accessible name.
 *
 * Reads the parsed node rather than the rendered children: by the time
 * `children` exists it is React elements, and pulling text back out of those is
 * guesswork. Returns null for a table with no header — the caller has a
 * fallback, and a wrong name is worse than a generic one.
 */
function firstHeaderCell(node: unknown): string | null {
  const walk = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return null;
    const element = value as {
      tagName?: string;
      value?: string;
      children?: unknown[];
    };
    if (typeof element.value === 'string' && element.value.trim()) {
      return element.value.trim();
    }
    for (const child of element.children ?? []) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };

  /*
   * The whole table, not `children[0]`. hast keeps the whitespace between tags
   * as text nodes, so the first child of a table is usually a newline rather
   * than its `thead` — and every table on the page came out named "Table",
   * which is the fallback, which is three identical stops again.
   *
   * Walking the whole node returns the first non-empty text in document order,
   * and in a table that is the first header cell.
   */
  return walk(node);
}

/** The number of cells in a table's first row — its column count. */
function columnCount(node: unknown): number {
  const rows: unknown[] = [];
  const walk = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const element = value as { tagName?: string; children?: unknown[] };
    if (element.tagName === 'tr') rows.push(element);
    else (element.children ?? []).forEach(walk);
  };
  walk(node);

  const first = rows[0] as { children?: unknown[] } | undefined;
  return (first?.children ?? []).filter(child => {
    const cell = child as { tagName?: string };
    return cell.tagName === 'th' || cell.tagName === 'td';
  }).length;
}

/** Every text node under `node`, concatenated — a heading's own words. */
function textOf(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const element = node as { value?: string; children?: unknown[] };
  if (typeof element.value === 'string') return element.value;
  return (element.children ?? []).map(textOf).join('');
}

/**
 * A charter page's body, rendered.
 *
 * 🔴 NO RAW HTML. `react-markdown` disallows it by default and nothing here
 * turns it back on. The bodies are generated from PDFs the municipality
 * publishes, and a transcription pipeline is exactly the path by which a
 * `<script>` would arrive if one were ever permitted through.
 *
 * Styling is explicit rather than `@tailwindcss/typography`'s `prose`, because
 * two things on these pages need to look like what they are:
 *
 *   · a BLOCKQUOTE is a passage quoted from the municipality's own document —
 *     the charter's own wording, or a list this project would have had to
 *     renumber in order to format, so it left it alone. It reads as a quotation
 *     because that is what it is.
 *   · a TABLE is the charter's requirements, and it must not push the page
 *     sideways on a phone. It scrolls inside its own container; the body never
 *     scrolls horizontally.
 */
export async function Markdown({ children }: { children: string }) {
  const t = await getTranslations('services');

  /*
   * The SAME slugger the "On this page" rail is built with — see
   * `markdown-outline.ts`. Two implementations of the id rule would agree until
   * the first duplicated heading and then send the rail to the wrong section.
   */
  const slug = createSlugger();

  /*
   * FULL WIDTH. Nothing here sets its own measure.
   *
   * A charter page is mostly TABLES — the checklist of requirements and the
   * five-column client-steps table — and a 65-character prose measure is the
   * wrong constraint for them: it forced both into a horizontal scroll on a
   * laptop where there was room to read them whole.
   *
   * An intermediate version kept `max-w-prose` on the paragraphs and headings
   * so text stayed at a readable line length. It left the page looking
   * half-empty beside its own tables, which is worse than a long line.
   * `Container`'s measure is the one page measure, and it is enough.
   */
  return (
    <div className="w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: () => null,
          h2: ({ children: content, node }) => (
            <h2
              className="font-display mt-10 scroll-mt-24 text-xl font-bold text-ink sm:text-2xl"
              id={slug(textOf(node)) ?? undefined}
            >
              {content}
            </h2>
          ),
          h3: ({ children: content }) => (
            <h3 className="mt-8 text-lg font-semibold">{content}</h3>
          ),
          p: ({ children: content }) => (
            <p className="mt-4 leading-relaxed text-ink-secondary">{content}</p>
          ),
          strong: ({ children: content }) => (
            <strong className="font-semibold text-ink">{content}</strong>
          ),
          a: ({ children: content, href }) => (
            <a
              className="font-medium text-ink-link underline underline-offset-2 hover:text-ink-link-hover"
              href={href}
              {...(href?.startsWith('http')
                ? { rel: 'noopener noreferrer', target: '_blank' }
                : {})}
            >
              {content}
            </a>
          ),
          ul: ({ children: content }) => (
            <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed text-ink-secondary marker:text-ink-tertiary">
              {content}
            </ul>
          ),
          ol: ({ children: content, start }) => (
            <ol
              // `start` is carried through, so a charter list that begins at 7
              // renders as 7. Dropping it renumbers the municipality's list.
              start={start ?? undefined}
              className="mt-4 list-decimal space-y-2 pl-6 leading-relaxed text-ink-secondary marker:font-semibold marker:text-ink-tertiary"
            >
              {content}
            </ol>
          ),
          li: ({ children: content }) => <li className="pl-1">{content}</li>,
          /*
           * Deliberately NOT italic. A blockquote here is usually the charter's
           * own wording, quoted at length, and a long run of italic is harder
           * work for exactly the readers who can least afford it. The quotation
           * is signalled by the ground and the rule instead.
           *
           * ⚠️ Three different things reach this component and are drawn alike:
           * the charter's wording, this project's ⚠️ transcription notes, and
           * the Filipino draft warning. Only the first is a quotation. Telling
           * them apart would mean the generator marking them — a content-lane
           * change (CONT-2xx), not a styling one.
           */
          blockquote: ({ children: content }) => (
            <blockquote className="mt-4 rounded-r-xl border-l-4 border-meter bg-surface-sunken py-3 pr-4 pl-4 text-ink">
              {content}
            </blockquote>
          ),
          /*
           * The table scrolls inside ITSELF. A requirements table with a
           * hundred-character cell is wider than 320px and always will be, and
           * a body that scrolls sideways is a design-system failure on the one
           * device most of this portal's readers use.
           */
          table: ({ children: content, node }) => (
            /*
             * 🔴 `tabIndex={0}` and a NAME, not just `overflow-x-auto`.
             *
             * A scrollable region with no keyboard access is a serious axe
             * violation and a real one: on a phone this table is wider than the
             * screen, and without a tab stop a keyboard or switch user cannot
             * reach the *where to get it* column at all — which is half the
             * answer they came for. `role="region"` plus the label is what
             * makes the stop mean something when it is announced.
             */
            <div
              // Named by its OWN first column, so three tables on one page are
              // three distinguishable stops rather than three identical ones.
              // A screen-reader user hears "Checklist of requirements, table"
              // rather than "table" three times.
              aria-label={t('scrollableTable', {
                name: firstHeaderCell(node) ?? t('table'),
              })}
              // The document's own frame: a hairline box on the raised ground,
              // corners rounded, and the header strip clipped by it.
              className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              role="region"
              tabIndex={0}
            >
              <table
                className={cn(
                  'charter-table',
                  /*
                   * A minimum width for a table with THREE OR MORE columns, and
                   * none below that.
                   *
                   * Every table used to carry `min-w-xl`, which forced the
                   * two-column facts table — *Office or Division*,
                   * *Classification* — to scroll sideways on a phone when it
                   * fits perfectly well. The five-column client-steps grid
                   * genuinely does not fit and has to scroll; squeezing it into
                   * 320px stacks every cell one word per line.
                   */
                  columnCount(node) > 2 && 'min-w-2xl'
                )}
              >
                {content}
              </table>
            </div>
          ),
          /*
           * A charter facts table is authored with an EMPTY header row — the
           * document labels its rows, not its columns. `remark-gfm` still emits
           * a `thead`, and rendering it paints an empty sunken strip above the
           * table and announces two blank column headers to a screen reader.
           */
          thead: ({ children: content, node }) =>
            textOf(node).trim() ? <thead>{content}</thead> : null,
          hr: () => <hr className="mt-10 border-line-subtle" />,
          code: ({ children: content }) => (
            <code className="rounded bg-surface-tint px-1.5 py-0.5 text-sm">
              {content}
            </code>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
