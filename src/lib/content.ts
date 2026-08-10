import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { cacheLife, cacheTag } from 'next/cache';
import yaml from 'js-yaml';
import { z } from 'zod';
import {
  charterManifestSchema,
  manifestSchema,
  timelineSchema,
  travelSchema,
  type CharterRecord,
  type PageEntry,
  type Timeline,
  type Travel,
} from '@/lib/content-schema';
import type { Locale } from '@/i18n/routing';

/**
 * The ONLY module in this application that reads the filesystem.
 *
 * `content/` is the data layer. No component, page, or route handler touches
 * `node:fs`; they receive parsed, validated, typed data from here. Adding a
 * page is a markdown + YAML change and requires no code change — if it ever
 * requires one, the route is wrong and the route is what gets fixed.
 *
 * Layout:
 *
 *   content/<section>/<category>/index.yaml     the manifest
 *   content/<section>/<category>/<slug>.md      the English body
 *   content/<section>/<category>/<slug>.fil.md  the Filipino body (optional)
 *
 * Every manifest entry carries its provenance. That is not decoration: this
 * portal restates a municipality's own published record, and a restatement
 * without a source and a check date beside it is a rumour with better
 * typography. The schema below makes the citation structurally impossible to
 * forget.
 */

const CONTENT_ROOT = path.join(process.cwd(), 'content');

export type PageDocument = {
  entry: PageEntry;
  body: string;
  /**
   * True when a Filipino reader is looking at English because no `.fil.md`
   * exists. The caller MUST surface this — the fallback is deliberate, and a
   * silent one is just an untranslated page pretending otherwise.
   */
  usedFallback: boolean;
};

/** Every category folder in a section, or `[]` if the section has none yet. */
export async function listCategories(section: string): Promise<string[]> {
  'use cache';
  cacheLife('max');
  cacheTag('content', `content:${section}`);

  try {
    const entries = await readdir(path.join(CONTENT_ROOT, section), {
      withFileTypes: true,
    });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();
  } catch {
    // A section with no content yet is an empty section, not a crash. This is
    // the normal state of a portal that has not been given permission to
    // publish anything yet.
    return [];
  }
}

/**
 * A category's manifest, validated.
 *
 * Malformed YAML throws. That is deliberate: a broken manifest caught at build
 * time is a red build, and a broken manifest tolerated at runtime is a page
 * that 404s while the file sits there looking correct.
 */
export async function getManifest(
  section: string,
  category: string
): Promise<PageEntry[]> {
  'use cache';
  cacheLife('max');
  cacheTag('content', `content:${section}`, `content:${section}/${category}`);

  const file = path.join(CONTENT_ROOT, section, category, 'index.yaml');

  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return [];
  }

  const parsed = manifestSchema.safeParse(yaml.load(raw));
  if (!parsed.success) {
    throw new Error(
      `Malformed manifest at content/${section}/${category}/index.yaml:\n${z.prettifyError(parsed.error)}`
    );
  }

  return parsed.data.pages;
}

/**
 * One page, in the requested locale, falling back to English when the Filipino
 * body does not exist.
 *
 * Returns `null` when the slug has no manifest entry OR the manifest entry has
 * no matching markdown file. Both are the caller's cue to call `notFound()` —
 * never to render a "not found" message inside a 200 response.
 */
export async function getPage(
  section: string,
  category: string,
  slug: string,
  locale: Locale
): Promise<PageDocument | null> {
  'use cache';
  cacheLife('max');
  cacheTag('content', `content:${section}/${category}`);

  const entry = (await getManifest(section, category)).find(
    page => page.slug === slug
  );
  if (!entry) return null;

  const dir = path.join(CONTENT_ROOT, section, category);

  if (locale !== 'en') {
    const localised = await read(path.join(dir, `${slug}.${locale}.md`));
    if (localised !== null)
      return { entry, body: localised, usedFallback: false };
  }

  const english = await read(path.join(dir, `${slug}.md`));
  if (english === null) {
    // The manifest promised a page that is not on disk. Silently 404-ing here
    // is how a broken slug survives review, so say which entry lied.
    throw new Error(
      `content/${section}/${category}/index.yaml lists "${slug}" but ${slug}.md does not exist. The YAML slug must match the markdown filename exactly.`
    );
  }

  return { entry, body: english, usedFallback: locale !== 'en' };
}

/**
 * A charter category's manifest, with the transcription attached.
 *
 * Separate from `getManifest` because it parses against a different contract.
 * `manifestSchema` is the generic page entry and strips everything ★ TAGO-201
 * added — the join back to the inventory, the ambiguity, and the charter's own
 * contents. A service route reading through the generic loader would render a
 * page with no fees on it and no error to say why.
 */
export async function getCharterManifest(
  section: string,
  category: string
): Promise<CharterRecord[]> {
  'use cache';
  cacheLife('max');
  cacheTag('content', `content:${section}`, `content:${section}/${category}`);

  const file = path.join(CONTENT_ROOT, section, category, 'index.yaml');

  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return [];
  }

  const parsed = charterManifestSchema.safeParse(yaml.load(raw));
  if (!parsed.success) {
    throw new Error(
      `Malformed charter manifest at content/${section}/${category}/index.yaml:\n${z.prettifyError(parsed.error)}`
    );
  }

  return parsed.data.pages;
}

/** One charter page, in the requested locale, with its record. */
export async function getCharterPage(
  section: string,
  category: string,
  slug: string,
  locale: Locale
): Promise<{
  entry: CharterRecord;
  body: string;
  usedFallback: boolean;
} | null> {
  'use cache';
  cacheLife('max');
  cacheTag('content', `content:${section}/${category}`);

  const entry = (await getCharterManifest(section, category)).find(
    page => page.slug === slug
  );
  if (!entry) return null;

  const dir = path.join(CONTENT_ROOT, section, category);

  if (locale !== 'en') {
    const localised = await read(path.join(dir, `${slug}.${locale}.md`));
    if (localised !== null)
      return { entry, body: localised, usedFallback: false };
  }

  const english = await read(path.join(dir, `${slug}.md`));
  if (english === null) {
    throw new Error(
      `content/${section}/${category}/index.yaml lists "${slug}" but ${slug}.md does not exist. The YAML slug must match the markdown filename exactly.`
    );
  }

  return { entry, body: english, usedFallback: locale !== 'en' };
}

/**
 * Every charter category, and the records in it.
 *
 * The services index and `generateStaticParams` both need the whole tree, and
 * both would otherwise walk it themselves. `content/government/legislative` is
 * included because two charter services live there rather than under
 * `services/` — a fact that has already produced one broken link.
 */
export async function getCharterSections(): Promise<
  { section: string; category: string; pages: CharterRecord[] }[]
> {
  'use cache';
  cacheLife('max');
  cacheTag('content');

  const categories = await listCategories('services');
  const sections = await Promise.all(
    categories.map(async category => ({
      section: 'services',
      category,
      pages: await getCharterManifest('services', category),
    }))
  );

  return sections.filter(entry => entry.pages.length > 0);
}

async function read(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * The municipality's history, as a short narrative timeline.
 *
 * ONE file, `content/home/history/timeline.yaml` — not the per-slug
 * `index.yaml` + markdown pattern the rest of `content/` uses, because a
 * timeline entry has no route of its own to be a "page" about: it is a dated
 * paragraph in a sequence, and `pageEntrySchema` has no field for a period or
 * a milestone flag. Malformed YAML throws, same as every other loader here —
 * a broken timeline caught at build time is a red build, not a page that
 * silently renders five of six entries.
 */
export async function getHistoryTimeline(): Promise<Timeline> {
  'use cache';
  cacheLife('max');
  cacheTag('content', 'content:home/history');

  const file = path.join(CONTENT_ROOT, 'home', 'history', 'timeline.yaml');
  const raw = await readFile(file, 'utf8');

  const parsed = timelineSchema.safeParse(yaml.load(raw));
  if (!parsed.success) {
    throw new Error(
      `Malformed timeline at content/home/history/timeline.yaml:\n${z.prettifyError(parsed.error)}`
    );
  }

  return parsed.data;
}

/**
 * How to reach the municipality, as a short set of orientation cards.
 *
 * Same shape and same reasoning as `getHistoryTimeline`: one YAML file rather
 * than the per-slug `index.yaml` + markdown pattern, because a travel card has
 * no route of its own to be a "page" about.
 */
export async function getTravelRoutes(): Promise<Travel> {
  'use cache';
  cacheLife('max');
  cacheTag('content', 'content:home/getting-here');

  const file = path.join(CONTENT_ROOT, 'home', 'getting-here', 'routes.yaml');
  const raw = await readFile(file, 'utf8');

  const parsed = travelSchema.safeParse(yaml.load(raw));
  if (!parsed.success) {
    throw new Error(
      `Malformed travel content at content/home/getting-here/routes.yaml:\n${z.prettifyError(parsed.error)}`
    );
  }

  return parsed.data;
}

export type {
  CharterRecord,
  PageEntry,
  SourceRef,
  Timeline,
  TimelineEntry,
  Travel,
  TravelCard,
  Verification,
} from '@/lib/content-schema';
export {
  manifestSchema,
  pageEntrySchema,
  sourceSchema,
  timelineSchema,
  travelSchema,
  verificationSchema,
} from '@/lib/content-schema';
