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

## A manifest entry

```yaml
pages:
  - name: 'Renew a business permit'
    slug: 'renew-a-business-permit'
    description: 'What to bring, where to go, what it costs, and how long it takes.'
    office: 'Business Licensing and Permitting Division'
    source:
      label:
        en: "Municipality of Tago Citizen's Charter — Business Licensing and Permitting Division"
      url: 'https://tago.gov.ph/about-us-2/citizens-charter/'
      documentTitle: 'Business Licensing and Permitting Division, External Services'
      documentType: 'pdf'
      retrievedAt: '2026-08-03'
    verification: 'V3'
    lastCheckedAt: '2026-08-03'
```

`source`, `verification` and `lastCheckedAt` are **required**. Cite or don't publish.

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

## A service guide answers eight questions

That shape is not invented — it is the shape of a Citizen's Charter entry, which is why the charter is the
spine of this portal.

```markdown
# Renew a business permit

One sentence on who this is for.

## Who can apply

## What to bring

## Where to go

## Office hours

## Fees

## How long it takes

## What you get

## If something goes wrong
```

**A guide missing _Fees_, _Where to go_, or _What to bring_ is not publishable** — those three are why the page
was opened.

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
