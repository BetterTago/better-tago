import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Reading the repository as text, for the scans that keep its rules true.
 *
 * Several test suites here work by walking a directory and matching patterns
 * against what they find — the self-containment sweep, the design-token sweep,
 * the content negatives. Each had grown its own walker, three of them by the
 * time anyone counted, differing only in which files they skipped. Three
 * walkers is the point at which one of them quietly stops recursing and its
 * suite goes green for the wrong reason.
 *
 * This is used by tests rather than by the application, and it lives in `lib/`
 * rather than beside one of them because no test file should import another.
 */

export const REPO_ROOT = process.cwd();

export type ScannedFile = {
  /** Repo-relative and forward-slashed, so a failure message is clickable. */
  path: string;
  text: string;
};

/**
 * Every file under `dir` whose basename matches, recursively.
 *
 * Returns `[]` for a directory that does not exist — a section with no content
 * yet is an empty section, not a crash. Callers that would be made vacuous by
 * an empty result must assert a floor on the count; that tripwire is the
 * caller's job because only the caller knows what "too few" means.
 */
export function filesMatching(dir: string, pattern: RegExp): ScannedFile[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap<ScannedFile>(
    entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return filesMatching(full, pattern);
      if (!pattern.test(entry.name)) return [];
      return [
        {
          path: path.relative(REPO_ROOT, full).replace(/\\/g, '/'),
          text: readFileSync(full, 'utf8'),
        },
      ];
    }
  );
}

/** Every shipped `.ts`/`.tsx` under a directory. Tests are not shipped. */
export function sourceFilesIn(dir: string): ScannedFile[] {
  return filesMatching(dir, /\.tsx?$/).filter(
    file => !/\.(test|spec)\.tsx?$/.test(file.path)
  );
}

/**
 * Every distinct match in each file, as `path → matched`.
 *
 * EVERY occurrence, de-duplicated per file, not the first: `String.match`
 * without `/g` returns one hit per file, which means a page carrying two
 * violations surfaces one — and defending that one silently hides the other.
 */
export function matchesIn(files: ScannedFile[], pattern: RegExp): string[] {
  return files.flatMap(file => {
    const everywhere = new RegExp(pattern.source, `${pattern.flags}g`);
    const found = [...file.text.matchAll(everywhere)].map(
      hit => `${file.path} → ${hit[0]}`
    );
    return [...new Set(found)];
  });
}
