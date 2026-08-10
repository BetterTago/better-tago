# `content/` — the data layer

Every word this portal publishes lives here as markdown plus a YAML manifest. **Adding a page is a content
change, not a code change.** If adding one ever requires touching a component, the route is wrong and the
route is what gets fixed.

## What is in here

**This folder holds the municipality's Citizen's Charter, transcribed.** Each service page names the task, says
which office provides it, links the municipality's own document — and carries that document's contents: who may
avail, what to bring, the fees, the processing time and the steps.

**That changed on 2026-08-10**, when ⛔ `PROG-003` was re-opened and the verbatim transcription came back into
scope. Before it, this folder held index-and-link records only: a resident learned which office and which PDF,
and then had to open an eight-page document on a phone for the three things they actually came for. The
proposal's own sentence is what closed that: _the information a resident needs in order to do something is
locked in a format they cannot use._ Linking the format was not unlocking it.

🔴 **Every charter string here is byte-identical to the PDF.** Same spelling, same capitalisation, same currency
notation, same numbering — including the document's own errors, which are reproduced and marked rather than
repaired. The archive prints `P 1,000.00`, `P1250.00`, `Php200.00` and `PHP100.00`, several of them inside one
file, and that inconsistency is data: it is what the counter and the form will say. Tidying it is the single
most tempting change anybody will propose to this content, and
`src/lib/transcription-integrity.test.ts` fails the build on it.

**What may be re-arranged is layout, never wording.** A five-column table is unreadable at 320px, so a row
becomes a step with the same five values under labels. Nothing is dropped, nothing is merged, nothing is
paraphrased.

## A page shows the transcription, in the document's own structure

🔴 **A service page is the charter entry as it was transcribed** — the four labelled facts, the checklist of
requirements, the client-steps table, the total — plus this project's frame around it: the citation, the
unverified notice, and what the charter does not say.

**It used to be re-sectioned** into ★ `TAGO-004`'s eight questions, with a paragraph of this project's prose
under each. That shape is a good shape and it was the wrong thing to build: it meant re-deriving every field out
of the transcription, and every field that could not be re-derived with confidence turned into a page saying
_this page cannot tell you yet_. **Thirty services said that while their transcription sat complete in the
record.**

The document's own structure IS the structure. A Citizen's Charter entry is written as four facts, a checklist
and a steps table, and that is what the counter works from. Presenting it as transcribed means **every one of
the 99 external services has a page with the answer on it.**

One renderer produces both the task page and the service's entry in the full-document transcript, so the two
views cannot drift — with **one** deliberate difference, below.

### Two things a task page never carries

🔴 **The completeness block.** _Also printed for this service_ gathers every fragment the document prints that
the structured blocks did not carry, and it is what lets the token-completeness check reach zero. It belongs on
the **transcript**, which exists to be checked against. On a task page it is a pile of loose fragments under the
answer, and a resident reading how to register a birth is not served by it. The guarantee is unharmed — the
check compares the document against the transcript, which is where the block lives.

🔴 **A section saying what the charter does not state.** It used to tell every reader that no document gives an
address or office hours. Both were already answered, and better: **Office or Division** names the office on
every page, and the hours are the standard government office hours rather than something each charter restates.
A page that spends a section saying it cannot tell you something it never needed to reads as less complete than
it is.

`src/lib/content-records.test.ts` fails the build if either reappears on a service page.

## Two rendering modes, and the line between them

`../scripts/charter-markdown.mjs` renders every charter list, and it works in one of two modes. **Which mode a
section used is visible on the page**, and that is deliberate.

**`list`** — the charter's structure is one markdown reproduces exactly, so it is rendered as a real list. The
document's own numbers open the items; sub-numbers (`2.1`, `2.2`) nest under their parent; bullets and dashes
nest as list items.

**`verbatim`** — it is not, so **nothing is attempted**. The transcription goes onto the page as it came out of
the document, line for line, quoted, under a notice saying so. Ten sections are in this mode today.

🔴 **Verbatim is not a failure state.** Markdown renumbers ordered lists by design — `1, 2, 4` comes back
`1, 2, 3` — and **eleven of these charters number lists that do not count up**, including one that reads
`1, 1, 1` and one that starts at 7. Others run two independent numbered sequences down a single table. Both
alternatives to quoting were tried first and both were worse: formatting those sections anyway **renumbered**
them, and leaving them unpublished took the set from 99 services to **14**.

A resident reading "requirement 7" needs it to be the document's 7. Where this project cannot guarantee that
while also making the section prettier, it stops making it prettier.

🔒 **Nothing in here is reachable by a URL yet, and that has not changed.** No route reads this folder, and a guardrail asserts that —
the route set is frozen to the holding page, and nothing in `src/` may import the content loader. That is not
an accident of the build; it is the Phase 0 position holding. **The municipality has not yet been told this
project exists**, and no public route ships until it has. Writing records is not publishing them, and the test
is what keeps the difference real rather than intended.

When that changes, the guardrail is deleted deliberately, in a diff somebody reviews. **Transcribing is not
publishing** — this pass wrote files and shipped no route, and `src/lib/guardrails.test.ts` § _nothing is public
while the Phase 0 gate is open_ is untouched by it. That test still passing is the proof, and it is mechanical
rather than editorial.

## Transcribed, and not yet verified

🔴 **No page here has been checked by a second person.** `PROG-101`'s rule is that whoever collects a fact never
verifies it, and the **Verifier role is vacant** (`../docs/governance.md`). So every transcribed page carries a
notice saying exactly that, `verificationRecord` is `null` on all of them, and a test asserts that none has
appeared. It goes red the day the first honest one does.

The figures are `V3` — read from the primary document — which meets `PROG-101`'s floor for publishing a fee.
That is a claim about the SOURCE, not about a second reading, and the two are not the same thing.

## `content: null` means the transcription is not good enough to publish

A record's `content` is the charter's contents, or it is `null`. **It is never partly filled.** A page showing
three of five requirements is more dangerous than one showing none, because it looks complete.

`content: null` is no longer used as a gate. The checks below still run and still record what they find:

- the extractor did not reach `high` confidence — the table it read has too many rows to be a service, or too
  few of them carry a time, or a page yielded no columns at all;
- **the requirements list does not read as a list of things to bring** — a bare bullet, a row continuing
  mid-sentence, or most items with no source on a table that paired some;
- the frozen enumeration (`../inventory/charter-services.yaml`) says the document STATES a field that the
  extraction could not read. **A page may not go out missing something the document is known to state.**

🔴 **The second gate exists because of a page that shipped without it.** `register-a-birth` passed everything
else — five columns, timed rows, a total — and published **forty requirements: nine bare bullets, thirty-eight
with no source, several cut off mid-sentence.** A resident could not have told what to bring from it, and it
looked complete, which is worse than the index-and-link page it replaced. The cause is not fixable by reading
harder: on those pages the _where to secure_ column is printed as one tall cell beside a dozen requirements, and
which address belongs to which item is not in the document's geometry at all.

**All 99 external services publish.** `confidence` is still recorded on every one — `high` on 123 of the 167
services in the archive, `needs-human` on the rest — but it now tells a **verifier** what to look at first
rather than deciding whether a resident sees anything at all.

🔴 **"Not stated in the charter" is a claim about the municipality's document, never a report of this project's
reading failing.** The frozen enumeration is the authority on what a document states; the extraction is only the
authority on what could be read out of it. The first draft of the generator got this backwards and published
_Fees: not stated in the charter_ on a service whose charter states its fees — a false statement about a public
document, on a civic page.

## Layout

```
content/<section>/<category>/index.yaml     the manifest
content/<section>/<category>/<slug>.md      the English body
content/<section>/<category>/<slug>.fil.md  the Filipino body (REQUIRED — coverage is 100%)
```

**The YAML `slug` must match the markdown filename exactly.** A mismatch is the one failure that looks like
nothing is wrong: the file sits there, correct, and the page 404s.

## The category is not yours to choose either

**A category is a task domain a resident would recognise — never an office name.** That is the title rule
([`../docs/task-titles.md`](../docs/task-titles.md)) applied one level up: an index organised by org chart is
exactly what the vocabulary exists to prevent.

Which category a service belongs to is decided once, in the `categories:` block of
[`../inventory/task-vocabulary.yaml`](../inventory/task-vocabulary.yaml), keyed by the office that owns it.
**A service moves category by editing that block — never by moving a file.** `src/lib/content-records.test.ts`
derives this folder from it and fails on a service filed anywhere else.

## A manifest entry

Everything under `content/services/` and `content/government/legislative/` is a **charter record** and carries
the ★ `TAGO-201` fields. Other sections use the plain page entry above them.

```yaml
pages:
  - name: 'Renew a business permit'
    slug: 'renew-a-business-permit'
    description: 'Renewing the permit a business already holds.'
    office: 'Business Licensing and Permitting Division'
    source:
      label:
        en: "Municipality of Tago Citizen's Charter — Business Licensing and Permitting Division"
      url: 'https://tago.gov.ph/wp-content/uploads/2024/12/…-External-Services.pdf'
      documentTitle: 'Business Licensing and Permitting Division External Services'
      documentType: 'pdf'
      retrievedAt: '2026-08-09'
    verification: 'V3'
    lastCheckedAt: '2026-08-09'
    # ── the charter record ──
    charterServiceId: 'business-licensing-and-permitting-division-external-services#external-3'
    charterSection: 'external'
    charterDocument:
      title: 'Business Licensing and Permitting Division External Services'
      file: 'Business-Licensing-and-Permitting-Division-External-Services.pdf'
      sha256: '…'
    charterTitle: 'Processing of Application for Business Permit Renewal'
    charterTitleSource: 'extracted'
    group: 'business-permit'
    ambiguity: null
    transcriptionNote: null
    verificationRecord: null
```

`source`, `verification` and `lastCheckedAt` are **required**. Cite or don't publish.

So are **`dataClass`** and **`lastReview`**, and both are about staying true rather than being true today:

- **`dataClass`** says how fast this page goes out of date — one of the classes in
  [`../config/freshness.config.json`](../config/freshness.config.json). **A page with no class fails the
  build**, because a page with no cadence never goes stale and nobody would notice for years. See
  [`../docs/freshness.md`](../docs/freshness.md).
- **`lastReview`** is `{ role, at }` or `null` — the **role** that last re-checked this against its source.
  Never a handle, never a name. It is `null` on every page today: nothing has been re-checked since it was
  written, and saying otherwise is the falsification the field exists to make visible.

🔴 **Do not advance `lastCheckedAt` without adding a `lastReview` in the same change.** A check date moved
without a check is a falsified record, and `inventory/check-dates.yaml` is the committed baseline that catches
it.

What the charter fields add, and why each one is not optional:

| Field                                 | What it is for                                                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `charterServiceId`                    | The inventory's stable id. It is what joins a page back to the frozen vocabulary — **not** the charter's printed number, which is not unique |
| `charterSection`                      | Always `external`. Internal services are government-to-government; the schema **refuses** the value rather than trusting review              |
| `charterDocument`                     | Title, filename and `sha256` of the copy actually read, so a later revision is detectable                                                    |
| `charterTitle` · `charterTitleSource` | The charter's own wording, and whether a human had to read it off the page. A human-supplied title must never read as a published one        |
| `group`                               | Set when the charter answers one resident question in more than one place. Grouped, **never merged**                                         |
| `ambiguity`                           | What the charter left unclear **for a resident**, carried onto the page as stated. A transcriber never resolves one. **This one renders**    |
| `transcriptionNote`                   | How _this project_ read the document — a truncated heading, a service number printed twice. Recorded for the verifier, **never rendered**    |
| `verificationRecord`                  | `null` until a second person has checked it. Never partially filled — whole, or null                                                         |

## A transparency register entry

Everything under `content/transparency/register/` is a **register record** and carries the ★ `TAGO-301` fields.
Its central field is a **status, not a URL** — because a labelled gap is honest and a silent omission is not,
so every mandated document has a row whether or not it was found.

```yaml
pages:
  - name: 'Annual budget'
    slug: 'annual-budget'
    description: 'The budget the municipal council enacts for a fiscal year.'
    source: { … }
    verification: 'V3'
    lastCheckedAt: '2026-08-09'
    # ── the register record ──
    documentName: 'Annual budget'
    fiscalYear: null # or '2022' — null where the document is not annual
    status: 'not-located' # linked | published | requested | not-located
    lookedFor:
      - label: 'Municipality of Tago — Transparency Seal page'
        url: 'https://tago.gov.ph/transparency-seal/'
        result: 'not-published-here'
        checkedAt: '2026-08-09'
    requestedOf: null
    requestedAt: null
```

⚠️ **`verification` on a `not-located` entry describes the CHECK, not a document.** `V3` means the absence was
observed first-hand at the primary address, dated and repeatable — not that an official record says the
document is missing, because none does. See [`../docs/governance.md`](../docs/governance.md) § _What a level
means on a recorded absence_. The entry must cite one of the addresses in its own `lookedFor` list, and a test
enforces it.

The schema **rejects** five things, each because it would make the register quietly dishonest: a `linked`
document with no address, a `not-located` one with nothing looked for, a `requested` one with no office and
date, request details on an entry nobody requested, and a person's name where an office belongs.

🔴 **It also refuses a statement of assets, liabilities and net worth outright**, under that name or its
acronym. Those are personal financial disclosures about identifiable people, the exclusion is permanent rather
than pending, and it is a property of the data because a contributor working from a list of mandated documents
would add one in good faith. The positive half — how a resident requests one — is an ordinary page in
`content/transparency/requests/`.

**Which documents the register accounts for is decided once**, in
[`../inventory/disclosure-set.yaml`](../inventory/disclosure-set.yaml), and
`src/lib/content-records.test.ts` derives the reconciliation from it. ⚠️ That file is explicit that it is
**this project's working list and not a legal enumeration** — the governing issuance was sought on 2026-08-09
and its portal does not resolve. Do not describe the register as complete.

## The title is not yours to invent

**A page's `name` comes from the frozen task vocabulary, not from the charter and not from your judgement on
the day.** Look the service up by its `id` in [`../inventory/task-vocabulary.yaml`](../inventory/task-vocabulary.yaml)
and use the `taskTitle` and `slug` recorded there.

Every page is titled as the **task a resident is trying to do**, never as the office that performs it — _"Renew
a business permit"_, not _"Processing of Application for Business Permit Renewal"_. Doing that consistently
across a hundred-odd services is why the vocabulary is agreed once rather than argued per page. The rules are
in [`../docs/task-titles.md`](../docs/task-titles.md).

The charter's own wording is not discarded — it is kept on the vocabulary entry, and the office name, document
names and fee names are used **verbatim inside the page**, because that is what the counter will ask for.

## What a page looks like today

Every charter record uses the same body, and the sameness is the point: ninety-nine pages written to one shape
is ninety-nine pages a reader can skim, and a shape that drifts per author is how a fee gets added to one of
them.

```markdown
# Renew a business permit

**Who provides it:** <office>, Tago Municipal Hall.

## What the charter calls it

> <the charter's own wording, verbatim>

## What to bring, what it costs, how long it takes

<the deliberate refusal, and why — unchanged wording>

## What the charter leaves unclear <!-- only when `ambiguity` is set; `transcriptionNote` never renders -->

## The official document

- [<document title>](url) — the Citizen's Charter for this office, retrieved <date>
```

## The eight questions — the shape that ships

A Citizen's Charter entry answers eight questions, and ★ `TAGO-004` froze them: _who can apply · what to bring ·
where to go · office hours · fees · how long it takes · what you get · if something goes wrong._ That shape is
the reason the charter is the spine of this portal, and since 2026-08-10 it is the shape a transcribed page
**must have**. `src/lib/content-records.test.ts` checks both directions:

- a page whose record carries `content` has all seven charter headings, in both locales;
- a page whose record is `content: null` has **none** of them. An empty `## Fees` on an untranscribed page tells
  a reader the fee question was answered.

That test used to assert the exact opposite. It was inverted rather than deleted, because the thing it protects
never changed: a charter page drifting away from one agreed shape is how a fee ends up on one page and not the
ninety-eight beside it.

## The full-document transcripts — `content/charter/documents/`

One page per archived charter PDF, carrying the **whole** document: every service in the document's own order
and wording, the column headers, the `TOTAL` rows, and the **68 internal services** that are between offices and
have no resident counter. Generated by `scripts/charter-pages.mjs` (CONT-213).

It is not a duplicate of the service pages. It is what makes _nothing was lost_ checkable rather than asserted:
`transcription-integrity.test.ts` compares every token of each source document against the markdown derived from
it, and the residue can only reach zero because this layer carries the parts a task page correctly leaves out.

**Internal services live here and nowhere else.** `charterSection` is a literal `'external'` in the schema —
publishing a government-to-government service as a resident task sends somebody to a counter they cannot
transact at. They are transcribed because they are part of the document, under a heading that says plainly there
is nothing for a resident to do.

## Rules for anything transcribed from an official document

1. Keep the retrieved copy, with its retrieval date, so the transcription can always be re-checked against what
   was actually published.
2. Transcribe each service into one task page. Do not merge services; do not summarise a fee.
3. **Never round, never simplify, never modernise a figure.** The exact figure, with its source.
4. Where the source is unclear, say so on the page and link it. Do not resolve an ambiguity by guessing.
5. **A second person checks the page against the source before it ships**, and never the person who
   transcribed it.
6. Where the source is silent on a field — office hours, most often — the field says _not stated in the
   charter_. That is a **recorded gap**, not a blank to fill: it goes into the gap register and renders as an
   absence. Never complete it from a neighbouring municipality, an older document, or what seems likely.

## No named people here — with one exception, which is this folder

A person's name is **data**. It belongs here or in `config/lgu.config.json`, beside its source and its check
date, and nowhere else — not in a doc, a code comment, a commit message, or a test fixture. Everywhere else,
refer to the **role**: "the Mayor", "the Municipal DRRM officer", "a maintainer".
