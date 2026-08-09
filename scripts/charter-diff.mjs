/**
 * The charter-revision diff pass — CONT-403.
 *
 *   npm run charter:diff        compare the archive against the recorded versions
 *   npm run charter:diff -- --record   append today's checksums to charter-versions.yaml
 *
 * When the municipality revises a Citizen's Charter document, every page
 * derived from it has to be re-checked. This produces the WORK LIST for that,
 * from the manifests, so the list cannot drift from the tree.
 *
 * 🔴 **This script never writes into `content/`, and a test asserts it.**
 * CONT-403 criterion 5: an automated fee edit is the exact failure this pass
 * exists to prevent. It reports; a human corrects; a second human verifies.
 *
 * ⚠️ **Why a derived record rather than the old PDF.** `sources/` is
 * git-ignored — those are the municipality's documents and are not
 * redistributed — so a re-harvest overwrites the only copy and a changed
 * checksum says *that* something moved with nothing left to say *what*.
 * `inventory/charter-versions.yaml` keeps every checksum this project has ever
 * retrieved with its date and the service list at that version. It survives a
 * fresh clone; the PDFs do not.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = path.resolve(import.meta.dirname, '..');
const VERSIONS = path.join(ROOT, 'inventory', 'charter-versions.yaml');
const TODAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
}).format(new Date());

const load = file =>
  yaml.load(readFileSync(path.join(ROOT, 'inventory', file), 'utf8'));

const documents = load('charter-documents.yaml').documents;
const services = load('charter-services.yaml').services;

const history = existsSync(VERSIONS)
  ? yaml.load(readFileSync(VERSIONS, 'utf8'))
  : { note: '', documents: {} };

/** Every content entry, with the charter document it cites. */
const derivedPages = [];
for (const rel of globSync('content/**/index.yaml', { cwd: ROOT }).sort()) {
  const manifest = yaml.load(readFileSync(path.join(ROOT, rel), 'utf8'));
  for (const page of manifest.pages ?? []) {
    if (page.charterDocument) {
      derivedPages.push({
        slug: page.slug,
        folder: path.dirname(rel).replace(/^content\//, ''),
        file: page.charterDocument.file,
        sha256: page.charterDocument.sha256,
      });
    }
  }
}

const changed = [];
for (const document of documents) {
  const recorded = history.documents?.[document.file];
  const last = recorded?.versions?.at(-1);
  if (last && last.sha256 !== document.sha256) {
    changed.push({
      file: document.file,
      from: last.sha256,
      to: document.sha256,
    });
  }
}

/** Pages whose cited checksum is no longer the one in the archive. */
const superseded = derivedPages.filter(page => {
  const current = documents.find(document => document.file === page.file);
  return current && current.sha256 !== page.sha256;
});

console.log(
  `charter:diff — ${documents.length} documents · ${derivedPages.length} derived pages`
);

if (changed.length === 0 && superseded.length === 0) {
  console.log(
    '  no revision detected: every checksum matches what is recorded.'
  );
} else {
  console.log(
    `\n  🔴 ${changed.length} document(s) changed since last recorded:`
  );
  for (const document of changed)
    console.log(
      `    ${document.file}\n      ${document.from}\n   →  ${document.to}`
    );

  console.log(`\n  WORK LIST — ${superseded.length} page(s) to re-check:`);
  for (const page of superseded)
    console.log(`    ${page.folder}/${page.slug}  (from ${page.file})`);

  console.log(
    '\n  Next steps, in this order and no other:\n' +
      '    1. These pages are stale NOW — charter-derived carries an immediate trigger\n' +
      '       for exactly this (config/freshness.config.json).\n' +
      '    2. A human re-checks each against the new document. Not this script.\n' +
      '    3. A SECOND human verifies it. The two-person rule does not weaken\n' +
      '       because a revision caused the change — see docs/governance.md.\n' +
      '    4. Only then does a check date move, with a lastReview beside it.'
  );
  process.exitCode = 1;
}

if (process.argv.includes('--record')) {
  const next = {
    note: 'Every checksum this project has retrieved for each Citizen’s Charter document, with the date and the service count at that version. APPEND-ONLY. This is the retained previous version CONT-403 criterion 4 asks for: the PDFs themselves are git-ignored and not redistributed, so this derived record is what survives a fresh clone and what makes a revision a diff rather than a re-transcription.',
    documents: { ...history.documents },
  };

  for (const document of documents) {
    const existing = next.documents[document.file]?.versions ?? [];
    if (existing.some(version => version.sha256 === document.sha256)) continue;
    existing.push({
      sha256: document.sha256,
      retrievedAt: TODAY,
      bytes: document.bytes,
      serviceCount: services.filter(
        service => service.document === document.file
      ).length,
      services: services
        .filter(service => service.document === document.file)
        .map(service => service.id),
    });
    next.documents[document.file] = { url: document.url, versions: existing };
  }

  writeFileSync(
    VERSIONS,
    `# Generated by scripts/charter-diff.mjs --record — APPEND-ONLY, never rewritten by hand.\n${yaml.dump(next, { lineWidth: 100, noRefs: true, quotingType: '"' })}`
  );
  console.log('\n  wrote inventory/charter-versions.yaml');
}
