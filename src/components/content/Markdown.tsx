import { getTranslations } from 'next-intl/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
          h2: ({ children: content }) => (
            <h2 className="mt-10 scroll-mt-24 text-xl font-bold sm:text-2xl">
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
          blockquote: ({ children: content }) => (
            <blockquote className="mt-4 border-l-4 border-line-control pl-4 text-ink-secondary italic">
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
              className="mt-6 -mx-4 overflow-x-auto px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring sm:mx-0 sm:px-0"
              role="region"
              tabIndex={0}
            >
              <table className="w-full min-w-xl border-collapse text-left text-sm">
                {content}
              </table>
            </div>
          ),
          thead: ({ children: content }) => (
            <thead className="border-b border-line">{content}</thead>
          ),
          th: ({ children: content }) => (
            <th className="px-3 py-2 align-top font-semibold">{content}</th>
          ),
          td: ({ children: content }) => (
            <td className="border-t border-line-subtle px-3 py-2 align-top leading-relaxed text-ink-secondary">
              {content}
            </td>
          ),
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
