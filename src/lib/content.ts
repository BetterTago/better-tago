import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { cacheLife, cacheTag } from 'next/cache';
import yaml from 'js-yaml';
import { z } from 'zod';
import { manifestSchema, type PageEntry } from '@/lib/content-schema';
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

async function read(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
}

export type { PageEntry, SourceRef, Verification } from '@/lib/content-schema';
export {
  manifestSchema,
  pageEntrySchema,
  sourceSchema,
  verificationSchema,
} from '@/lib/content-schema';
