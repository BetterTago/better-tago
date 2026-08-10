import { highlight } from '@/lib/highlight';

/**
 * A string with the searched terms marked.
 *
 * 🔴 **No `dangerouslySetInnerHTML`, and that is the entire design.** The query
 * is a route segment a stranger controls; the obvious implementation builds a
 * string containing `<mark>` and injects it, which would put untrusted input
 * into the page as markup. `highlight()` returns segments instead, and React
 * escapes every one of them on the way out.
 *
 * With no query — a category list rather than a search result — this renders the
 * text and nothing else, so one row component serves both.
 */
export function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query) return text;

  return highlight(text, query).map((segment, index) =>
    segment.matched ? (
      <mark
        // Segments are positional and the list never reorders — the index IS
        // the identity here.
        key={index}
        className="rounded-xs bg-accent-400 px-0.5 text-ink-on-accent"
      >
        {segment.text}
      </mark>
    ) : (
      <span key={index}>{segment.text}</span>
    )
  );
}
