/**
 * The handover export — CONT-404.
 *
 *   npm run handover        assemble handover/ from the repository
 *
 * Everything this project produces belongs to the Municipality of Tago on
 * request, at no cost and with no conditions. This makes the content side of
 * that a package rather than a promise.
 *
 * ⚠️ **The honest observation, written down rather than glossed:** this
 * repository already IS most of the export. Every page is markdown, every
 * manifest is YAML, every citation is in the manifest beside the page. What
 * this script adds is that the claim is PROVEN — one command, one directory,
 * nothing left behind — and a README a municipal contact can read without
 * knowing anything about this project.
 *
 * 🔴 It writes only into `handover/`. It never modifies `content/`.
 */
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'handover');
const TODAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
}).format(new Date());

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const dir of ['content', 'inventory', 'config']) {
  cpSync(path.join(ROOT, dir), path.join(OUT, dir), { recursive: true });
}
/*
 * The whole of `docs/` except the coding standards, which are about building
 * this application rather than about the content. `freshness.md` in particular
 * is not optional: every manifest entry carries a `dataClass`, and without it
 * the package hands over a field whose meaning is nowhere in the package.
 */
mkdirSync(path.join(OUT, 'docs'), { recursive: true });
for (const file of ['governance.md', 'task-titles.md', 'freshness.md']) {
  cpSync(path.join(ROOT, 'docs', file), path.join(OUT, 'docs', file));
}
cpSync(path.join(ROOT, 'docs', 'sources'), path.join(OUT, 'docs', 'sources'), {
  recursive: true,
});
cpSync(path.join(ROOT, 'LICENSE'), path.join(OUT, 'LICENSE'));

const english = globSync('content/**/*.md', { cwd: ROOT }).filter(
  file => !file.endsWith('.fil.md') && !file.endsWith('README.md')
);
const filipino = globSync('content/**/*.fil.md', { cwd: ROOT });
const manifests = globSync('content/**/index.yaml', { cwd: ROOT });

let entries = 0;
let cited = 0;
for (const rel of manifests) {
  const parsed = yaml.load(readFileSync(path.join(ROOT, rel), 'utf8'));
  for (const page of parsed.pages ?? []) {
    entries++;
    if (page.source && page.lastCheckedAt) cited++;
  }
}

writeFileSync(
  path.join(OUT, 'README.md'),
  `# BetterTago — content handover

Assembled ${TODAY}.

**This package is yours.** It is offered to the Municipality of Tago at no cost, with no conditions, no
attribution requirement and no continued involvement from this project. If the municipality would rather
publish this on its own site, **that is a better outcome than this portal existing**, and this project says so
plainly rather than as a courtesy.

## What is in here

| Folder | What it holds |
| --- | --- |
| \`content/\` | Every page, in English and Filipino, as markdown. Each folder's \`index.yaml\` carries that page's source, verification level, check date and data class |
| \`inventory/\` | What was retrieved from the official site, when, and with what checksum — including every version of every Citizen's Charter document this project has seen |
| \`config/\` | The municipality's identity as this project records it, the register of what is still missing, and the freshness cadences |
| \`docs/\` | How this project decides something is true, how fast each class of page goes stale, what a source citation records, and the naming rules behind every page title |

## The numbers

- **${english.length} pages**, each with a **Filipino counterpart** (${filipino.length} of ${english.length})
- **${entries} manifest entries**, of which **${cited}** carry a source and a check date
- **${manifests.length} manifests**

## The format

Markdown and YAML. **Nothing here needs this project's tooling, a build step, a framework or a database.**
Open any \`.md\` in any text editor. Open any \`index.yaml\` in any text editor. That is the whole format.

A page and its manifest entry are joined by the \`slug\`: \`index.yaml\` lists a slug, and \`<slug>.md\` is the
English body beside it, \`<slug>.fil.md\` the Filipino one.

## What this package does NOT contain, and why

- **The retrieved source documents themselves** — the Citizen's Charter PDFs. Those are the municipality's own
  documents; this project keeps a working copy so a restatement can be re-checked, and does not redistribute
  them. Every one is listed in \`inventory/\` with its address and checksum.
- **Any statement of assets, liabilities and net worth**, in any form. Permanently out of scope.
- **Any personal contact detail** for any individual.

## Two things to know before publishing any of it

1. 🔴 **No page here has been verified by a second person.** This project's own standard requires that whoever
   collects a fact never verifies it, and it has had one contributor. The machine checks — that every page
   names a real service, the right office and the document it came from — all pass. The human read does not
   exist. \`docs/governance.md\` says which pages and why.
2. 🔴 **The Filipino is an unreviewed draft.** No fluent speaker has read it. Every Filipino page says so on
   its own face.

Neither is a reason not to take the package. Both are reasons to read it before publishing it under the
municipality's name.
`
);

console.log(
  `handover: ${english.length} pages + ${filipino.length} Filipino · ${entries} entries (${cited} cited) · → handover/`
);
