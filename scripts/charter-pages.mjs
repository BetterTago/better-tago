/**
 * `npm run charter:pages` — the extracted drafts become pages.
 *
 * Two layers, one extraction, ONE renderer:
 *
 *   content/services/<category>/<slug>.md   the ANSWER — one page per resident
 *                                           task
 *   content/charter/documents/<stem>.md     the RECORD — one page per PDF, the
 *                                           whole document in order, including
 *                                           the internal services a resident
 *                                           has no counter for
 *
 * `renderServiceRecord` produces the service body on both, so the two views of
 * a service cannot drift.
 *
 * ─── WHAT THIS GENERATOR MAY AND MAY NOT DO ──────────────────────────────────
 *
 * 🔴 It may not RE-SECTION. An earlier version rebuilt every service into ★
 * TAGO-004's eight questions, which meant re-deriving each field out of the
 * transcription — and every field that could not be re-derived produced a page
 * saying *this page cannot tell you yet*. Thirty services said that while their
 * transcription sat complete in the record. The document's own structure is the
 * structure: four labelled facts, a checklist, a steps table, a total.
 *
 * 🔴 It may not re-WORD. Every charter string is written out byte-for-byte —
 * same spelling, same capitalisation, same currency notation, same numbering,
 * including the document's own errors. The Tourism charter prints `35 inutes`;
 * this writes `35 inutes`, marks it, and leaves the correction to the office
 * that owns the document.
 *
 * Titles, slugs, offices, groups and categories are JOINED from
 * inventory/task-vocabulary.yaml by id. They are never re-derived here — the
 * vocabulary is frozen (CONT-002), and a generator that re-derived a title
 * would quietly disagree with the URL a resident already has.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

import { documentStem } from './charter-parse.mjs';
import { renderList } from './charter-markdown.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const INVENTORY = path.join(ROOT, 'inventory');
const TRANSCRIPTS = path.join(INVENTORY, 'charter-transcripts');
const CONTENT = path.join(ROOT, 'content');

const load = file => yaml.load(readFileSync(file, 'utf8'));

const RETRIEVED = '2026-08-09';
const TRANSCRIBED = '2026-08-10';

/** Long-form Filipino dates, as the existing pages write them. */
const FIL_DATE = '9 Agosto 2026';

// ── the fixed prose, in both languages ──────────────────────────────────────
//
// Project prose is translated; charter strings never are. A requirement is what
// the counter will ask for BY NAME, and rendering `Certificate of Live Birth`
// into Filipino produces a phrase no clerk will recognise. The page is
// bilingual around the document, not over it.

const COPY = {
  en: {
    provides: 'Who provides it',
    calls: 'What the charter calls it',
    asTranscribed: 'What the charter says',
    unclear: 'What the charter leaves unclear',
    wrong: 'If something goes wrong',
    document: 'The official document',
    documentSuffix: 'the Citizen’s Charter for this office, retrieved',
    readWhole: 'Read the whole document, transcribed',
    callsNote:
      'That is the municipality’s own wording, reproduced exactly. It is worth knowing, because it is the wording the counter and the form will use.',
    asTranscribedNote:
      'Transcribed from the municipality’s own document, in the document’s own structure and wording. Nothing below has been re-worded, re-ordered or summarised.',
    unclearNote:
      'Guessing which reading is right would be inventing a fact, so this page carries the question rather than an answer. Read the document below.',
    wrongBody:
      'This page is a transcription of the municipality’s own document by an independent volunteer project. It is not an official channel, and it cannot process anything for you.\n\n**If the office tells you something different from this page, the office is right.** Charters are revised, and a page transcribed on one date can fall behind. The correction link in the footer is the fastest way to get this page fixed — corrections from the municipality go to the front of the queue.',
    disagree:
      'Where this page and that document disagree, **the document is right and this page is wrong.**',
  },
  fil: {
    provides: 'Sino ang nagbibigay nito',
    calls: 'Ano ang tawag dito ng charter',
    asTranscribed: 'Ano ang sinasabi ng charter',
    unclear: 'Ang hindi malinaw sa charter',
    wrong: 'Kung may mali',
    document: 'Ang opisyal na dokumento',
    documentSuffix: 'ang Citizen’s Charter para sa opisinang ito, kinuha noong',
    readWhole: 'Basahin ang buong dokumento, nakatranskribe',
    callsNote:
      'Iyan ang sariling pananalita ng munisipyo, kinopya nang eksakto. Mahalagang malaman, dahil iyan ang pananalitang gagamitin sa counter at sa form.',
    asTranscribedNote:
      'Isinalin mula sa sariling dokumento ng munisipyo, sa sariling istruktura at pananalita ng dokumento. Walang nasa ibaba ang muling isinulat, inayos o binuod.',
    unclearNote:
      'Ang paghula kung alin ang tamang pagbasa ay pag-imbento ng katotohanan, kaya dala ng pahinang ito ang tanong at hindi ang sagot. Basahin ang dokumento sa ibaba.',
    wrongBody:
      'Ang pahinang ito ay transkripsyon ng sariling dokumento ng munisipyo, gawa ng isang independiyenteng boluntaryong proyekto. Hindi ito opisyal na channel, at wala itong maiproproseso para sa inyo.\n\n**Kung iba ang sabihin sa inyo ng opisina kaysa sa pahinang ito, ang opisina ang tama.** Binabago ang mga charter, at ang pahinang isinulat sa isang petsa ay maaaring maiwan. Ang correction link sa footer ang pinakamabilis na paraan para maayos ito — ang mga pagwawasto mula sa munisipyo ay unang inaasikaso.',
    disagree:
      'Kung magkaiba ang pahinang ito at ang dokumentong iyon, **tama ang dokumento at mali ang pahinang ito.**',
  },
};

/** The Filipino draft warning every FIL page already carries. */
const FIL_DRAFT_NOTICE =
  '> **Paunawa:** Ang Filipino sa pahinang ito ay **draft, hindi pa nasusuri ng katutubong nagsasalita.** ' +
  'Bakante pa ang tungkulin ng Translator sa proyektong ito. Kung may mali, ang correction link sa footer ' +
  'ang pinakamabilis na paraan para maayos ito.';

/**
 * The tokenisation the completeness ledger and its check both compare with.
 *
 * Case and punctuation folded away, words kept. Defined once so the generator
 * and the test cannot drift into disagreeing about what "carried through" means.
 */
const tokensOf = text =>
  text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(token => token.length > 0);

/**
 * Everything each service actually rendered, across both layers.
 *
 * Filled as pages are written and read once at the end to work out what the
 * rendered markdown did NOT carry. Keyed by inventory id.
 */
const renderedByService = new Map();

const noteRendered = (id, markdown) => {
  renderedByService.set(
    id,
    (renderedByService.get(id) ?? '') + '\n' + markdown
  );
};

/** Markdown table cells must not break the table. */
const cell = value =>
  String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, ' ')
    .trim();

/**
 * One service, exactly as it was transcribed.
 *
 * 🔴 THIS IS THE WHOLE OF WHAT A SERVICE PAGE SHOWS, and it is the same
 * function the full-document transcript uses. The two cannot drift, because
 * there is only one of them.
 *
 * An earlier version re-sectioned every service into ★ TAGO-004's eight
 * questions — *who can apply · what to bring · where to go · office hours ·
 * fees · how long it takes · what you get · if something goes wrong* — with a
 * paragraph of this project's prose under each. That shape is a good shape, and
 * it was the wrong thing to build: it required re-deriving every field out of
 * the transcription, and every field that could not be re-derived with
 * confidence turned into a page saying *this page cannot tell you yet*. Thirty
 * services said that while their transcription sat complete in the record.
 *
 * The document's own structure is the structure. Four labelled facts, a
 * checklist, a steps table, a total — that is how a Citizen's Charter entry is
 * written, and it is what the counter is working from. Presenting it as it was
 * transcribed means every service that transcribed at all has a page with the
 * answer on it.
 *
 * Nothing here is re-worded. `cell()` escapes pipes so a table survives and
 * changes nothing else.
 */
function renderServiceRecord(service, locale, { link } = {}) {
  const out = [];

  if (link) out.push(`- → [${link.name}](${link.href})`, '');

  const facts = [
    ['Office or Division', service.officeOrDivision],
    ['Classification', service.classification],
    ['Type of Transaction', service.typeOfTransaction],
    ['Who may Avail', service.whoMayAvail],
  ].filter(([, value]) => value);

  if (facts.length > 0) {
    out.push('| | |', '| --- | --- |');
    for (const [label, value] of facts)
      out.push(`| ${label} | ${cell(value)} |`);
    out.push('');
  }

  if (service.requirements.length > 0) {
    out.push(
      `**${locale === 'en' ? 'Checklist of requirements' : 'Listahan ng requirement'}**`,
      ''
    );
    out.push(
      '| Checklist of requirements | Where to secure |',
      '| --- | --- |'
    );
    for (const requirement of service.requirements) {
      out.push(
        `| ${cell(requirement.item)} | ${cell(requirement.whereToSecure ?? '—')} |`
      );
    }
    out.push('');
  }

  if ((service.unpairedSources ?? []).length > 0) {
    out.push(
      locale === 'en'
        ? '**Where to secure**, as the charter prints it — beside the list as a whole rather than against each item:'
        : '**Saan kukunin**, ayon sa pagkakalimbag ng charter — sa tabi ng buong listahan at hindi sa bawat item:',
      ''
    );
    // Through the formatter, because this is the one place a charter list is
    // still rendered AS a list — and some of these carry the document's own
    // numbering, which markdown would renumber.
    out.push(...renderList(service.unpairedSources).lines, '');
  }

  if (service.steps.length > 0) {
    out.push(`**${locale === 'en' ? 'Client steps' : 'Mga hakbang'}**`, '');
    out.push(
      '| Client steps | Agency action | Fees to be paid | Processing time | Person responsible |',
      '| --- | --- | --- | --- | --- |'
    );
    for (const step of service.steps) {
      out.push(
        `| ${cell(step.clientStep)} | ${cell(step.agencyAction)} | ${cell(step.fee)} | ` +
          `${cell(step.processingTime)} | ${cell(step.personResponsible ?? step.unresolved)} |`
      );
    }
    if (service.total) {
      out.push(
        `| **TOTAL** | | **${cell(service.total.fee)}** | ` +
          `**${cell(service.total.processingTime)}** | |`
      );
    }
    out.push('');
  }

  /*
   * ⚠️ NO COMPLETENESS BLOCK, ON ANY PAGE.
   *
   * There used to be an *Also printed for this service* section here holding
   * every fragment the document prints that the tables above did not carry — a
   * preamble, a footnote, a heading poppler split in half. It was removed from
   * task pages first and from the transcripts on 2026-08-10, both at the
   * project lead's instruction: it read as a pile of loose text under the
   * answer, and on a transcript it sat under a table that already said the same
   * thing in a readable shape.
   *
   * 🔴 WHERE THE COMPLETENESS GUARANTEE LIVES NOW. It moved, it did not go. The
   * full line-by-line text of every service is committed in
   * `inventory/charter-transcripts/*.yaml`, and `transcription-integrity.test.ts`
   * checks the PDF against THAT — so "no word of the document was lost" is
   * still a fact the build proves. What is no longer true is that every
   * fragment appears on a rendered page. A fragment orphaned by the extraction
   * is in the record, and a verifier reads the record.
   */

  if (service.extractionFlags.includes('source-typo-in-total')) {
    out.push(
      locale === 'en'
        ? '> ⚠️ The total above is reproduced exactly as the document prints it, including a spelling the document got wrong. It is not corrected here: a silent correction would make this page impossible to check against the original.'
        : '> ⚠️ Ang kabuuan sa itaas ay kinopya nang eksakto tulad ng nakalimbag sa dokumento, kasama ang maling baybay ng dokumento. Hindi ito itinama rito: ang tahimik na pagwawasto ay magpapahirap na masuri ang pahinang ito laban sa orihinal.',
      ''
    );
  }

  return out;
}

// ── the service page ────────────────────────────────────────────────────────

function servicePage(entry, service, locale) {
  const copy = COPY[locale];
  const out = [];

  out.push(`# ${entry.name}`, '');
  if (locale === 'fil') out.push(FIL_DRAFT_NOTICE, '');

  out.push(`**${copy.provides}:** ${entry.office}, Tago Municipal Hall.`, '');

  /*
   * ⚠️ A blockquote stood here — *"Transcribed from the document below, and not
   * yet checked by a second person."* Removed on 2026-08-10 by instruction.
   *
   * 🔴 What it said is still TRUE: `verificationRecord` is `null` on every
   * record and the Verifier role is vacant. The claim now reaches a reader only
   * through the source block at the foot of the page — `VerificationBadge` and
   * the deference line — rather than above the fees it applies to. Nothing about
   * the DATA changed, and nothing here may be read as a claim that a second
   * person has checked anything.
   */

  out.push(
    `## ${copy.calls}`,
    '',
    `> ${entry.charterTitle}`,
    '',
    copy.callsNote,
    ''
  );

  if (entry.charterTitleSource === 'read-from-pdf') {
    out.push(
      locale === 'en'
        ? '⚠️ **That heading was read off the document by hand**, because the charter does not print one above this service. It is this project’s reading of the page, not the municipality’s published wording, and it is recorded as such.'
        : '⚠️ **Ang pamagat na iyon ay binasa mula sa dokumento nang manu-mano** (read off the document by hand), dahil walang inilimbag na pamagat ang charter sa itaas ng serbisyong ito. Ito ay pagbasa ng proyektong ito sa pahina, hindi ang inilathalang pananalita ng munisipyo, at naitala ito bilang ganoon.',
      ''
    );
  }

  // ── the transcription, as transcribed ──────────────────────────────────────
  out.push(`## ${copy.asTranscribed}`, '', copy.asTranscribedNote, '');
  const record = renderServiceRecord(service, locale);
  if (locale === 'en') noteRendered(service.id, record.join('\n'));
  out.push(...record);

  if (entry.ambiguity) {
    const stated =
      locale === 'fil'
        ? (entry.ambiguityFil ?? entry.ambiguity)
        : entry.ambiguity;
    out.push(`## ${copy.unclear}`, '', `> ${stated}`, '', copy.unclearNote, '');
  }
  /*
   * ⚠️ There was a `## One question, more than one charter entry` section here,
   * rendered for the 22 services whose vocabulary `group` is set. Removed on
   * 2026-08-10 by instruction as irrelevant to a resident.
   *
   * The `group` field itself is UNTOUCHED in the record — it is how the
   * vocabulary records that the charter answers one question twice, and it is
   * still what stops two entries being silently merged into one page. What was
   * removed is only the paragraph on the page explaining that to a reader who
   * came for a fee.
   */

  out.push(`## ${copy.wrong}`, '', copy.wrongBody, '');

  const stem = documentStem(entry.charterDocument.file);
  out.push(
    `## ${copy.document}`,
    '',
    `- [${entry.charterDocument.title}](${entry.source.url}) — ${copy.documentSuffix} ` +
      `${locale === 'fil' ? FIL_DATE : RETRIEVED}`,
    `- [${copy.readWhole}](/${locale}/charter/documents/${stem})`,
    '',
    copy.disagree,
    ''
  );

  return `${out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;
}

// ── the document transcript ─────────────────────────────────────────────────

function documentPage(document, services, meta, bySlug, locale) {
  const out = [];
  const external = services.filter(service => service.section === 'external');
  const internal = services.filter(service => service.section === 'internal');

  out.push(`# ${meta.title}`, '');
  if (locale === 'fil') out.push(FIL_DRAFT_NOTICE, '');

  out.push(
    locale === 'en'
      ? `> **This is a complete transcription of the municipality’s own Citizen’s Charter document for this office.** It carries every service the document sets out, in the document’s own order and wording — including the services that are between offices and have no resident counter. Where this page and the document disagree, the document is right.`
      : `> **Ito ay buong transkripsyon ng sariling dokumentong Citizen’s Charter ng munisipyo para sa opisinang ito.** Dala nito ang bawat serbisyong inilahad ng dokumento, sa sariling pagkakasunod-sunod at pananalita nito — kasama ang mga serbisyong nasa pagitan ng mga opisina at walang counter para sa residente. Kung magkaiba ang pahinang ito at ang dokumento, ang dokumento ang tama.`,
    ''
  );

  out.push(
    `**${locale === 'en' ? 'Source' : 'Pinagmulan'}:** [${meta.title}](${meta.url}) · ` +
      `${document.serviceCount.total} ${locale === 'en' ? 'services' : 'serbisyo'} · ` +
      `${locale === 'en' ? 'retrieved' : 'kinuha noong'} ${locale === 'fil' ? FIL_DATE : RETRIEVED} · ` +
      `\`sha256:${document.sha256.slice(0, 16)}…\``,
    ''
  );

  const section = (heading, list, note) => {
    out.push(`## ${heading} — ${list.length}`, '');
    if (list.length === 0) {
      out.push(
        locale === 'en'
          ? '_This document sets out none._'
          : '_Wala nito ang dokumentong ito._',
        ''
      );
      return;
    }
    if (note) out.push(note, '');

    for (const service of list) {
      const title =
        service.charterTitle ??
        (locale === 'en'
          ? '_(untitled in the charter)_'
          : '_(walang pamagat sa charter)_');
      out.push(
        `### ${service.number ? `${service.number}. ` : ''}${title}`,
        ''
      );

      // The SAME renderer the task page uses. The two views of a service
      // cannot drift, because there is only one of them.
      const page = bySlug.get(service.id);
      const rendered = renderServiceRecord(service, locale, {
        link: page
          ? {
              name: page.name,
              href: `/${locale}/${page.folder}/${page.slug}`,
            }
          : null,
      });
      if (locale === 'en') noteRendered(service.id, rendered.join('\n'));
      out.push(...rendered);
    }
  };

  section(
    locale === 'en' ? 'External services' : 'Mga panlabas na serbisyo',
    external,
    null
  );
  section(
    locale === 'en' ? 'Internal services' : 'Mga panloob na serbisyo',
    internal,
    locale === 'en'
      ? '**These are between municipal offices — government to government.** They are transcribed here because they are part of the document, not because there is anything for a resident to do. There is no counter to go to and nothing to apply for.'
      : '**Ito ay sa pagitan ng mga opisina ng munisipyo — gobyerno sa gobyerno.** Nakatranskribe ito rito dahil bahagi ito ng dokumento, hindi dahil may magagawa ang residente. Walang counter na pupuntahan at walang aaplayan.'
  );

  return `${out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`;
}

// ── wiring ─────────────────────────────────────────────────────────────────

/**
 * Which fields the charter is SILENT on — and the distinction that makes it
 * safe to say so.
 *
 * 🔴 "Not stated in the charter" is a claim about the municipality's document,
 * and it must never be a report of this project's own reading failing. The
 * frozen inventory (`charter-services.yaml`, CONT-001 ✅) records per service
 * whether the document HAS a fees column, a requirements list, an eligibility
 * line. That is the authority on what the document says; the extraction is only
 * the authority on what could be read out of it.
 *
 * So a field is *not stated* only when the inventory agrees it is absent. Where
 * the inventory says present and the extraction read nothing, the page says
 * that instead — see `unreadFor`. The first draft of this generator got it
 * wrong and published "Fees: not stated in the charter" on a service whose
 * charter states its fees, which is a false statement about a public document.
 */
function notStatedFor(service, known) {
  const missing = ['whereToGo', 'officeHours'];
  if (!known || known.output === 'absent') missing.push('output');
  if (!service.whoMayAvail && (!known || known.eligibility === 'absent')) {
    missing.push('eligibility');
  }
  if (
    service.requirements.length === 0 &&
    (!known || known.requirements === 'absent')
  ) {
    missing.push('requirements');
  }
  if (
    service.fees.length === 0 &&
    !service.total?.fee &&
    (!known || known.fees === 'absent')
  ) {
    missing.push('fees');
  }
  if (
    service.processingTimes.length === 0 &&
    !service.total?.processingTime &&
    (!known || known.processingTime === 'absent')
  ) {
    missing.push('processingTime');
  }
  return missing;
}

/**
 * The record's structured half.
 *
 * ⚠️ It is no longer a GATE. It used to be null whenever the extraction could
 * not be re-sectioned into the eight-field guide, and the page then said *this
 * page cannot tell you yet* — on thirty services whose transcription was sitting
 * complete in the record the whole time. The page now publishes the
 * transcription itself, so this is provenance and search material rather than
 * the thing that decides whether a resident sees anything.
 *
 * `confidence` and the unread-field check are still recorded, because a
 * verifier needs to know which pages the tooling was sure about.
 */
function contentFor(service, known) {
  return {
    eligibility: service.whoMayAvail ?? null,
    classification: service.classification ?? null,
    typeOfTransaction: service.typeOfTransaction ?? null,
    requirements: service.requirements.map(requirement => ({
      item: requirement.item ?? '—',
      marked: requirement.marked === true,
      whereToSecure: requirement.whereToSecure ?? null,
    })),
    requirementSources: service.unpairedSources ?? [],
    /*
     * 🔴 A ROW WITH NO SCHEMA FIELD IN IT IS DROPPED HERE, not rendered blank.
     *
     * `charterStepSchema` holds five fields. A row whose only content was
     * `unlabelled` — a figure the extractor refused to label because its column
     * was named by position alone — has none of them, and serialised as five
     * nulls: **412 blank table rows** across the archive, 453 of them on the
     * building-permit page before the empty-band filter caught the rest.
     *
     * Nothing is lost. That text is in `service.text`, so it reaches
     * `inventory/charter-completeness.json` and the completeness check still
     * measures zero residue against it.
     */
    steps: service.steps
      .map(step => ({
        clientStep: step.clientStep ?? null,
        agencyAction: step.agencyAction ?? null,
        fee: step.fee ?? null,
        processingTime: step.processingTime ?? null,
        personResponsible: step.personResponsible ?? null,
      }))
      .filter(step => Object.values(step).some(value => value !== null)),
    totalFee: service.total?.fee ?? null,
    totalProcessingTime: service.total?.processingTime ?? null,
    fees: service.fees,
    processingTimes: service.processingTimes,
    mergedColumns: service.mergedColumns,
    columnsNamedBy: service.columnsNamedBy,
    proseColumnsTrusted: service.proseColumnsTrusted,
    stepsAreStructured: service.stepsAreStructured !== false,
    extractionFlags: service.extractionFlags,
    notStated: notStatedFor(service, known),
  };
}

function main() {
  /*
   * `inventory/task-vocabulary.yaml` is no longer READ here — the only thing
   * this generator took from it was the `groups` map, and the section that
   * rendered was removed on 2026-08-10. The vocabulary is still the frozen
   * authority on titles, slugs and categories (CONT-002); those reach the page
   * through the manifests, which are built from it elsewhere.
   */
  const documents = load(path.join(INVENTORY, 'charter-documents.yaml'));
  // The frozen enumeration is the authority on what each document STATES.
  // The extraction is only the authority on what could be read out of it.
  const known = new Map(
    load(path.join(INVENTORY, 'charter-services.yaml')).services.map(entry => [
      entry.id,
      entry.fields,
    ])
  );
  const services = new Map();
  const byDocument = new Map();
  for (const file of readdirSync(TRANSCRIPTS).filter(name =>
    name.endsWith('.yaml')
  )) {
    const document = load(path.join(TRANSCRIPTS, file));
    byDocument.set(document.document, document);
    for (const service of document.services) services.set(service.id, service);
  }

  // ── layer 1 · the service pages ────────────────────────────────────────────
  const categoryOf = new Map();
  let written = 0;
  let transcribed = 0;

  const manifests = [];
  const walk = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.yaml') manifests.push(full);
    }
  };
  walk(path.join(CONTENT, 'services'));
  walk(path.join(CONTENT, 'government', 'legislative'));

  for (const manifestPath of manifests) {
    const manifest = load(manifestPath);
    const folder = path
      .relative(CONTENT, path.dirname(manifestPath))
      .replace(/\\/g, '/');
    let changed = false;

    for (const entry of manifest.pages) {
      const service = services.get(entry.charterServiceId);
      if (!service) continue;

      categoryOf.set(entry.charterServiceId, {
        name: entry.name,
        slug: entry.slug,
        // The FOLDER, not a category derived from it. Two of these services
        // live under `government/legislative/` rather than `services/`, and
        // stripping the `services/` prefix built them a link to
        // `/services/government/legislative/…`, which is nowhere.
        folder,
      });

      const content = contentFor(service, known.get(entry.charterServiceId));
      entry.content = content;
      transcribed += 1;
      changed = true;

      for (const locale of ['en', 'fil']) {
        const file = path.join(
          path.dirname(manifestPath),
          `${entry.slug}${locale === 'fil' ? '.fil' : ''}.md`
        );
        writeFileSync(file, servicePage(entry, service, locale), 'utf8');
        written += 1;
      }
    }

    if (changed) {
      writeFileSync(
        manifestPath,
        `${MANIFEST_BANNER}${yaml.dump(manifest, { lineWidth: 100, noRefs: true })}`,
        'utf8'
      );
    }
  }

  // ── layer 2 · the document transcripts ────────────────────────────────────
  const outDir = path.join(CONTENT, 'charter', 'documents');
  mkdirSync(outDir, { recursive: true });

  const documentPages = [];
  for (const meta of documents.documents) {
    const document = byDocument.get(meta.file);
    if (!document) continue;
    const slug = documentStem(meta.file);
    const list = document.services;

    for (const locale of ['en', 'fil']) {
      writeFileSync(
        path.join(outDir, `${slug}${locale === 'fil' ? '.fil' : ''}.md`),
        documentPage(document, list, meta, categoryOf, locale),
        'utf8'
      );
    }

    documentPages.push({
      dataClass: 'charter-derived',
      name: meta.title,
      slug,
      description:
        `The Municipality of Tago's Citizen's Charter for this office, transcribed in full — ` +
        `${document.serviceCount.external} external and ${document.serviceCount.internal} internal services.`,
      source: {
        label: { en: `Municipality of Tago Citizen's Charter — ${meta.title}` },
        url: meta.url,
        documentTitle: meta.title,
        documentType: 'pdf',
        retrievedAt: RETRIEVED,
      },
      verification: 'V3',
      lastCheckedAt: RETRIEVED,
      lastReview: null,
      charterDocument: {
        title: meta.title,
        file: meta.file,
        sha256: meta.sha256,
      },
      transcribedAt: TRANSCRIBED,
      serviceCount: document.serviceCount,
    });
  }

  writeFileSync(
    path.join(outDir, 'index.yaml'),
    `${TRANSCRIPT_BANNER}${yaml.dump({ pages: documentPages }, { lineWidth: 100, noRefs: true })}`,
    'utf8'
  );

  // ── the completeness ledger ───────────────────────────────────────────────
  //
  // 🔴 `inventory/charter-completeness.json` — REFERENCE ONLY, NEVER RENDERED.
  //
  // Every line the source document prints that the rendered markdown does not
  // carry: a preamble, a footnote, a heading poppler split mid-word, a stray
  // fragment left by a column boundary. It used to be an *Also printed for this
  // service* block on the page, and it was removed from both layers because it
  // read as a pile of loose text under an answer that already said the same
  // thing in a readable shape.
  //
  // It still has to exist. Without it "no word of the document was lost" is an
  // assertion rather than a fact, and the whole transcription rests on being
  // checkable against the original. So it lives here — in `inventory/`, which
  // `inventory/README.md` already declares is not content and is never
  // published — and `transcription-integrity.test.ts` proves the residue is
  // zero against the union of the rendered pages and this file.
  //
  // 🔴 NOT under `content/`. Nothing in `src/` may read it, and a guardrail
  // asserts both. It is for a verifier reading against the PDF; it is not
  // something a resident should ever be shown.
  const ledger = {
    note: 'REFERENCE ONLY — never rendered, never served. Every line the source document prints that the generated markdown does not carry. Deleting this file breaks the completeness guarantee in src/lib/transcription-integrity.test.ts. See scripts/charter-pages.mjs.',
    generatedBy: 'scripts/charter-pages.mjs',
    transcribedAt: TRANSCRIBED,
    services: {},
  };

  let carried = 0;
  let orphaned = 0;

  for (const [id, service] of services) {
    const rendered = new Set(tokensOf(renderedByService.get(id) ?? ''));
    const leftover = service.text.filter(text =>
      tokensOf(text).some(token => !rendered.has(token))
    );

    carried += service.text.length - leftover.length;
    orphaned += leftover.length;

    ledger.services[id] = {
      charterTitle: service.charterTitle,
      section: service.section,
      document: service.document ?? null,
      linesInDocument: service.text.length,
      notRendered: leftover,
    };
  }

  ledger.totals = {
    services: services.size,
    linesCarriedByThePages: carried,
    linesHeldOnlyHere: orphaned,
  };

  writeFileSync(
    path.join(INVENTORY, 'charter-completeness.json'),
    `${JSON.stringify(ledger, null, 2)}\n`,
    'utf8'
  );

  process.stdout.write(
    `${written} service page files · ${transcribed} carrying the charter's contents\n` +
      `${documentPages.length * 2} document transcript files\n` +
      `completeness ledger: ${orphaned} of ${carried + orphaned} document lines held only there\n`
  );
}

const MANIFEST_BANNER = `# The charter, transcribed.
#
# Each entry names a service, says which office provides it, links the municipality's own
# document — and since 2026-08-10 carries that document's CONTENTS: who may avail, what to
# bring, the fees, the processing time and the steps.
#
# 🔴 Every string under \`content\` is byte-identical to the PDF. No figure is rounded,
# reformatted or modernised, and the document's own errors are reproduced rather than
# repaired. src/lib/transcription-integrity.test.ts fails the build on a figure that does
# not trace back to its source document.
#
# \`content: null\` means the extraction was not good enough to publish and a human has not
# yet transcribed it from the page. It is never a partial fill.
#
# Titles, slugs, offices, groups and ambiguities are joined from inventory/task-vocabulary.yaml
# by charterServiceId. Do not re-derive one. Generated by scripts/charter-pages.mjs.
`;

const TRANSCRIPT_BANNER = `# The full-document transcripts — one per archived charter PDF (CONT-213).
#
# Generated by scripts/charter-pages.mjs. One entry per document in inventory/charter-documents.yaml,
# and a build check fails on a missing one.
#
# These pages carry the WHOLE document, including the internal services that have no resident
# counter. That completeness is what makes the token-completeness check in
# src/lib/transcription-integrity.test.ts able to reach zero.
`;

main();
