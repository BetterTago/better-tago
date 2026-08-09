# `content/` — the data layer

Every word this portal publishes lives here as markdown plus a YAML manifest. **Adding a page is a content
change, not a code change.** If adding one ever requires touching a component, the route is wrong and the
route is what gets fixed.

## What is in here, and what is deliberately not

**This folder holds index-and-link records.** Each one names a service or an office, says which office provides
it, and links the municipality's own document. That shape needs no permission at all, which is why it is the
shape this project took.

🔴 **No charter text is transcribed into it.** No fee, no requirement list, no processing time, no steps. Those
are the contents of the municipality's own document, republishing them is a permission this project has not
asked for, and they are **out of scope rather than pending**. A page here that states a fee is a defect, and
`src/lib/guardrails.test.ts` fails the build on one.

🔒 **Nothing in here is reachable by a URL yet.** No route reads this folder, and a guardrail asserts that —
the route set is frozen to the holding page, and nothing in `src/` may import the content loader. That is not
an accident of the build; it is the Phase 0 position holding. **The municipality has not yet been told this
project exists**, and no public route ships until it has. Writing records is not publishing them, and the test
is what keeps the difference real rather than intended.

When that changes, the guardrail is deleted deliberately, in a diff somebody reviews.

## Layout

```
content/<section>/<category>/index.yaml     the manifest
content/<section>/<category>/<slug>.md      the English body
content/<section>/<category>/<slug>.fil.md  the Filipino body (optional)
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

## One question, more than one charter entry <!-- only when `group` is set -->

## What the charter leaves unclear <!-- only when `ambiguity` is set; `transcriptionNote` never renders -->

## The official document

- [<document title>](url) — the Citizen's Charter for this office, retrieved <date>
```

## The eight questions — the shape that returns with a permission

A Citizen's Charter entry answers eight questions, and ★ `TAGO-004` froze them: _who can apply · what to bring ·
where to go · office hours · fees · how long it takes · what you get · if something goes wrong._ That shape is
the reason the charter is the spine of this portal, and it is recorded here so it is not lost.

🔴 **It is also the shape a page must not have today.** Those headings are the charter's contents, republishing
them is the permission ⛔ `PROG-003` records as **out of scope rather than pending**, and
`src/lib/content-records.test.ts` fails the build on any of them appearing under `content/services/`.

**That is not a contradiction, it is a sequence.** The eight-field guide is what this project publishes the day
a written permission to transcribe and republish with attribution arrives. Until then the index is the
deliverable, and the guide's headings appearing on a page means somebody started transcribing without one.

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
