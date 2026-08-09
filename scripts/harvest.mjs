/**
 * Harvest the Municipality of Tago's official site into an inventory.
 *
 * This reads a public website that explicitly permits it, records what it
 * found and when, and writes an INVENTORY — a work list. It publishes nothing,
 * and it must never be extended to. `CONT-001`'s own terms: a service
 * appearing on the portal from this enumeration alone is a failure.
 *
 * What it produces:
 *   inventory/site-pages.yaml        every public page, from the sitemap
 *   inventory/charter-documents.yaml every charter PDF: title, URL, date, sha256
 *   inventory/charter-services.yaml  every service, with six fields present/absent
 *   sources/charter/*.pdf            the retrieved PDFs — GIT-IGNORED, not redistributed
 *
 * Run: npm run harvest
 * Needs: pdftotext (poppler-utils). Chosen over a JS PDF library because
 * `-layout` preserves the charter's table columns, and those are fee tables.
 *
 * Console output is this script's user interface, so the no-console rule that
 * governs `src/` does not apply here.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import yaml from 'js-yaml';
import { parseCharter, withServiceIds } from './charter-parse.mjs';

const ORIGIN = 'https://tago.gov.ph';
const SITEMAP = `${ORIGIN}/wp-sitemap.xml`;

/**
 * Identifies the project and links somewhere a site owner can see what it is.
 * A harvester that hides what it is has already made this project's core
 * promise — that it is open about what it does — untrue.
 */
const USER_AGENT =
  'BetterTago-harvester/1.0 (volunteer civic index; +https://github.com/BetterTago/better-tago)';

/** One request at a time, with a gap. This is somebody's public web server. */
const DELAY_MS = 1000;

const ROOT = path.resolve(import.meta.dirname, '..');
const INVENTORY = path.join(ROOT, 'inventory');
const ARCHIVE = path.join(ROOT, 'sources', 'charter');

/**
 * The date the harvest ran, which is the date every fact below was checked.
 * In the municipality's own timezone, not the contributor's — a retrieval date
 * that reads as yesterday to the people who published the document is a small
 * lie in a field this project treats as load-bearing.
 */
const TODAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
}).format(new Date());

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// robots.txt — a permission with a date, not a standing right
// ---------------------------------------------------------------------------

/**
 * Parses the `*` group. Deliberately strict: anything it cannot parse is
 * treated as disallowed, because the failure mode of guessing wrong is
 * hammering a municipal server this project is trying to be a good guest of.
 */
function parseRobots(text) {
  const disallowed = [];
  let inStar = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [field, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const name = field.trim().toLowerCase();
    if (name === 'user-agent') inStar = value === '*';
    else if (inStar && name === 'disallow' && value) disallowed.push(value);
  }
  return disallowed;
}

function assertAllowed(url, disallowed) {
  const { pathname } = new URL(url);
  const rule = disallowed.find(prefix => pathname.startsWith(prefix));
  if (rule) {
    throw new Error(
      `robots.txt disallows ${pathname} (rule: "${rule}"). Stopping.\n` +
        `This is not a bug to work around — the site's terms changed and the harvest ends here.`
    );
  }
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

let requestCount = 0;

async function get(url, disallowed) {
  assertAllowed(url, disallowed);
  if (requestCount > 0) await sleep(DELAY_MS);
  requestCount += 1;
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response;
}

const getText = async (url, disallowed) => (await get(url, disallowed)).text();

async function getBinary(url, disallowed) {
  const response = await get(url, disallowed);
  return Buffer.from(await response.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

const locsIn = xml =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].trim());

async function discoverPages(disallowed) {
  const index = await getText(SITEMAP, disallowed);
  const pages = [];
  for (const child of locsIn(index)) {
    pages.push(...locsIn(await getText(child, disallowed)));
  }
  return [...new Set(pages)];
}

const CHARTER_PAGE = /citizens-charter/i;
const OFFICE_PAGE = /\/municipal-offices\/[a-z-]+\/[a-z0-9-]+\/?$/i;
const LEGISLATIVE_PAGE = /\/municipal-offices\/legislative-offices\//i;

/*
 * Words that appear in nearly every office name and so distinguish nothing.
 * Dropping them is what lets `office-of-the-municipal-vice-mayor` (a page slug)
 * be recognised as the same office as `Office-of-the-Vice-Mayor.pdf`.
 */
const COMMON_WORDS = new Set([
  'office',
  'offices',
  'of',
  'the',
  'municipal',
  'services',
  'service',
  'external',
  'internal',
  'division',
  'pdf',
]);

const distinctiveWords = value =>
  new Set(
    value
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(word => word && !COMMON_WORDS.has(word))
  );

/**
 * Is this document one of the legislative offices' charters?
 *
 * The site does not answer this directly — the charter pages carry no
 * Executive/Legislative split, and the legislative office pages link no PDFs
 * at all. What the site does state is WHICH OFFICES are legislative, under
 * `/municipal-offices/legislative-offices/`. So the classification is derived
 * from that list by matching office names, rather than hardcoded here.
 */
function isLegislative(fileName, legislativeSlugs) {
  const words = distinctiveWords(fileName);
  return legislativeSlugs.some(slug => {
    const slugWords = [...distinctiveWords(slug)];
    return slugWords.length > 0 && slugWords.every(word => words.has(word));
  });
}

const HTML_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#039;': "'",
  '&#8217;': '’',
  '&nbsp;': ' ',
};

const decodeEntities = value =>
  value.replace(
    /&(?:amp|lt|gt|quot|#039|#8217|nbsp);/g,
    match => HTML_ENTITIES[match] ?? match
  );

/**
 * Same-origin PDF links on a page, WITH THE TEXT THEY ARE PUBLISHED UNDER.
 *
 * The link text matters and is not decoration: both tickets ask for documents
 * listed by their *exact published title*, and a filename is not that. One
 * document is filed as `Tourism-External-Services.pdf` and published as
 * "Tourism Office" — recording the filename version would put words in the
 * municipality's mouth, which is the whole thing this project must not do.
 */
function pdfLinksIn(html) {
  const links = new Map();

  for (const [, href, inner] of html.matchAll(
    /<a\b[^>]*href=["']([^"']*\.pdf)["'][^>]*>(.*?)<\/a>/gis
  )) {
    const url = decodeEntities(href);
    if (!url.startsWith(ORIGIN)) continue;
    const text = decodeEntities(inner.replace(/<[^>]+>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (text && !links.has(url)) links.set(url, text);
  }

  // A PDF can also be referenced outside an anchor — an embedded viewer, say.
  // Those are still documents; they simply arrive with no published title.
  for (const [match] of html.matchAll(/https?:\/\/[^"'\s<>]+?\.pdf/gi)) {
    const url = decodeEntities(match);
    if (url.startsWith(ORIGIN) && !links.has(url)) links.set(url, null);
  }

  return links;
}

// ---------------------------------------------------------------------------
// PDF text
// ---------------------------------------------------------------------------

function pdfToText(file) {
  const result = spawnSync('pdftotext', ['-layout', file, '-'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error?.code === 'ENOENT') {
    throw new Error(
      'pdftotext not found. Install poppler-utils:\n' +
        '  Debian/Ubuntu: sudo apt install poppler-utils\n' +
        '  macOS:         brew install poppler'
    );
  }
  if (result.status !== 0) {
    throw new Error(`pdftotext failed on ${file}: ${result.stderr}`);
  }
  return result.stdout;
}

// ---------------------------------------------------------------------------
// Parsing the charter
// ---------------------------------------------------------------------------

/*
 * Every charter PDF follows the national ARTA layout:
 *
 *   <Office Name>
 *   External Services            <- or Internal Services
 *   1. <Service title>
 *      <description>
 *   Office or Division:  ...
 *   Classification:      ...
 *   Type of Transaction: ...
 *   Who may avail:       ...
 *   CHECKLIST OF REQUIREMENTS            | WHERE TO SECURE
 *   CLIENT STEPS | AGENCY ACTION | FEES TO BE PAID | PROCESSING TIME | ...
 *   TOTAL | <fee> | <duration>
 *
 * The section header matters and is easy to miss: INTERNAL services are
 * government-to-government and are not resident tasks. Publishing one as a
 * resident task would send someone to a counter for something they cannot ask
 * for, so the section is recorded per service rather than flattened away.
 */

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const BANNER =
  '# Generated by scripts/harvest.mjs — do not edit by hand.\n' +
  '# An INVENTORY, not content. Nothing here is published; see inventory/README.md.\n';

function writeYaml(file, data) {
  const body = yaml.dump(data, {
    lineWidth: 100,
    noRefs: true,
    quotingType: '"',
  });
  writeFileSync(path.join(INVENTORY, file), `${BANNER}${body}`);
  console.log(`  wrote inventory/${file}`);
}

/**
 * The per-document source note: what was retrieved, and what was derived from
 * it. Generated rather than written, so it cannot drift from the archive it
 * describes — a source note that disagrees with its document is worse than
 * none, because it looks checked.
 */
function writeSourceNotes(documents, services) {
  const lines = [
    '<!-- Generated by scripts/harvest.mjs — do not edit by hand. -->',
    '',
    '# Source notes — the Citizen’s Charter',
    '',
    `Retrieved from the Municipality of Tago’s official website on **${TODAY}**.`,
    'Each document below is archived under `sources/charter/`, which is git-ignored:',
    'these are the municipality’s documents, kept so a transcription can always be',
    're-checked against what was actually published, and not redistributed from here.',
    '',
    'The `sha256` is what makes a later revision detectable rather than assumed.',
    '',
  ];

  for (const document of documents) {
    const mine = services.filter(service => service.document === document.file);
    const external = mine.filter(service => service.section === 'external');
    lines.push(
      `## ${document.title}`,
      '',
      `- **Retrieved from:** ${document.url}`,
      `- **Retrieved at:** ${document.retrievedAt}`,
      `- **sha256:** \`${document.sha256}\``,
      `- **Size:** ${document.bytes.toLocaleString('en-US')} bytes`,
      `- **Branch:** ${document.branch}`,
      `- **Derived:** ${mine.length} services — ${external.length} external, ` +
        `${mine.length - external.length} internal`,
      ''
    );
  }

  writeFileSync(path.join(INVENTORY, 'source-notes.md'), lines.join('\n'));
  console.log('  wrote inventory/source-notes.md');
}

// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(INVENTORY, { recursive: true });
  mkdirSync(ARCHIVE, { recursive: true });

  console.log(`Harvesting ${ORIGIN} — ${TODAY}`);

  const robots = await fetch(`${ORIGIN}/robots.txt`, {
    headers: { 'user-agent': USER_AGENT },
  });
  if (!robots.ok) throw new Error('Could not read robots.txt. Stopping.');
  const disallowed = parseRobots(await robots.text());
  console.log(
    `  robots.txt disallows: ${disallowed.join(', ') || '(nothing)'}`
  );

  const pages = await discoverPages(disallowed);
  const charterPages = pages.filter(url => CHARTER_PAGE.test(url));
  const officePages = pages.filter(url => OFFICE_PAGE.test(url));
  const legislativePages = officePages.filter(url =>
    LEGISLATIVE_PAGE.test(url)
  );
  const legislativeSlugs = legislativePages.map(url =>
    url.replace(/\/$/, '').split('/').pop()
  );
  console.log(
    `  ${pages.length} pages · ${charterPages.length} charter · ${officePages.length} office ` +
      `(${legislativePages.length} legislative)`
  );
  if (legislativePages.length === 0) {
    console.warn(
      '  ! No legislative office pages found. Every charter document will be ' +
        'recorded as executive, which may be wrong — check the site structure.'
    );
  }

  /*
   * The full sitemap is counted but not listed, and that is a rule about
   * names rather than about size. Many of the remaining URLs are news posts
   * and councillor profile pages whose SLUGS CONTAIN PEOPLE'S NAMES. A name
   * belongs in the content layer beside a source and a check date, where one
   * edit corrects it after an election — not baked into a generated file
   * outside it. The pages this project actually works from carry none.
   */
  writeYaml('site-pages.yaml', {
    harvestedAt: TODAY,
    origin: ORIGIN,
    sitemap: SITEMAP,
    pageCount: pages.length,
    note: 'Only the pages this project works from are listed. The remainder are news posts and individual profile pages, counted below but not enumerated: their URLs carry personal names, which belong in content/ beside a source and a date, not in a generated inventory.',
    charterPages,
    officePages,
    legislativePages,
    unlistedPages:
      pages.length -
      new Set([...charterPages, ...officePages, ...legislativePages]).size,
  });

  // Every charter page contributes its PDFs; one office publishes its charter
  // on its own page rather than the shared index, which is why this unions
  // across pages instead of trusting the index alone.
  // Which charter page a PDF hangs off is how the site itself separates
  // Executive from Legislative. Taking that from the structure beats guessing
  // from the filename, and CONT-001 needs the two counted separately.
  const linkedFrom = new Map();
  const publishedTitle = new Map();
  for (const url of charterPages) {
    for (const [pdf, text] of pdfLinksIn(await getText(url, disallowed))) {
      linkedFrom.set(pdf, [...(linkedFrom.get(pdf) ?? []), url]);
      if (text && !publishedTitle.has(pdf)) publishedTitle.set(pdf, text);
    }
  }
  const pdfUrls = new Set(linkedFrom.keys());
  console.log(`  ${pdfUrls.size} charter PDFs linked`);

  const documents = [];
  const services = [];

  for (const url of [...pdfUrls].sort()) {
    const name = decodeURIComponent(url.split('/').pop());
    const file = path.join(ARCHIVE, name);
    const bytes = await getBinary(url, disallowed);
    writeFileSync(file, bytes);

    const text = pdfToText(file);
    const parsed = parseCharter(text);
    const sections = [
      ...new Set(parsed.map(service => service.section)),
    ].sort();

    const published = publishedTitle.get(url) ?? null;
    documents.push({
      // The municipality's own words where they exist. Where a PDF is linked
      // with no text, the filename is a stand-in and says so, so nobody later
      // mistakes a derived string for a published one.
      title: published ?? name.replace(/\.pdf$/i, '').replace(/-/g, ' '),
      titleSource: published ? 'published-link-text' : 'derived-from-filename',
      file: name,
      url,
      linkedFrom: linkedFrom.get(url) ?? [],
      branch: isLegislative(name, legislativeSlugs)
        ? 'legislative'
        : 'executive',
      retrievedAt: TODAY,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      sections,
      serviceCount: {
        external: parsed.filter(s => s.section === 'external').length,
        internal: parsed.filter(s => s.section === 'internal').length,
        unknown: parsed.filter(s => s.section === 'unknown').length,
      },
    });

    // The id is stamped here rather than in the parser because it needs the
    // document's name, which the parser never sees — it is handed text.
    for (const service of withServiceIds(name, parsed))
      services.push({ document: name, ...service });
    console.log(`  ${name} — ${parsed.length} services`);
  }

  /*
   * The reconciliation CONT-001 asks for. One office publishes its charter as
   * two files — External and Internal — so a file count is not an office
   * count, and collapsing that suffix is what makes the two agree.
   */
  const officesIn = branch =>
    new Set(
      documents
        .filter(document => document.branch === branch)
        .map(document =>
          document.file.replace(/-(External|Internal)-Services/i, '')
        )
    ).size;

  writeYaml('charter-documents.yaml', {
    harvestedAt: TODAY,
    documentCount: documents.length,
    executiveDocuments: documents.filter(d => d.branch === 'executive').length,
    legislativeDocuments: documents.filter(d => d.branch === 'legislative')
      .length,
    distinctExecutiveOffices: officesIn('executive'),
    distinctLegislativeOffices: officesIn('legislative'),
    note: 'PDFs are archived under sources/charter/, which is git-ignored. They are the municipality’s documents and are not redistributed from here.',
    documents,
  });

  const external = services.filter(service => service.section === 'external');
  const absent = key =>
    external.filter(service => service.fields[key] === 'absent').length;

  writeYaml('charter-services.yaml', {
    harvestedAt: TODAY,
    serviceCount: {
      total: services.length,
      external: external.length,
      internal: services.filter(s => s.section === 'internal').length,
    },
    gapsInExternalServices: {
      eligibility: absent('eligibility'),
      requirements: absent('requirements'),
      fees: absent('fees'),
      processingTime: absent('processingTime'),
      owningOffice: absent('owningOffice'),
      output: absent('output'),
    },
    // Services whose document carries no numbered heading to title them. They
    // are real services and need a human to name them from the page before
    // any of them can become a task page.
    titlesNeedingManualEntry: services.filter(
      service => service.titleStatus === 'not-in-layout'
    ).length,
    services,
  });

  writeSourceNotes(documents, services);

  console.log(
    `\nDone. ${documents.length} documents, ${services.length} services ` +
      `(${external.length} external, ${services.length - external.length} internal).`
  );
}

main().catch(error => {
  console.error(`\nHarvest failed: ${error.message}`);
  process.exitCode = 1;
});
