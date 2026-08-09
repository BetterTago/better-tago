# Task titles — how a page is named

**Every page is titled as the task a resident is trying to do, not as the office that performs it.** That one
rule is what turns the Citizen's Charter from an org chart into something findable.

The charter is written from the counter outward. It calls a service _"Processing of Application for Business
Retirement"_, because that is what the office does. The resident on the other side of the counter is trying to
**close their business**, and that is what they will type into a search box, ask a neighbour, or scan a page
for. A portal titled the first way is a filing cabinet. Titled the second way, it answers.

Doing that consistently across a hundred-odd services needs the vocabulary **agreed once**, not renegotiated
per page — which is what `inventory/task-vocabulary.yaml` is. This file is the rules behind it.

> **The rules that can be checked are checked.** `src/lib/task-vocabulary.test.ts` fails the build on a title
> that breaks one. Where a rule needs a list — the permitted verbs, the acronyms a resident knows — that list
> lives in `inventory/task-vocabulary.yaml` under `namingRules`, and the test reads it from there. There is one
> copy, so this document and the check cannot drift apart.

## The rules

### 1. Verb first, imperative, and about the reader

**Start with what the resident does.** No gerunds, no noun phrases, no "Processing of".

| ✅                                      | ❌                                                    |
| --------------------------------------- | ----------------------------------------------------- |
| Renew a business permit                 | Processing of Application for Business Permit Renewal |
| Register a birth                        | Registration of births for on-time and delayed report |
| Get a certificate of indigency          | Securing Certificate of Indigency                     |
| Get an animal vaccinated against rabies | Provision of Vaccinations (Anti Rabies)               |

The permitted opening verbs are listed in `namingRules.imperativeVerbs`. It is deliberately short. If a service
genuinely needs a verb that is not there, **add it to the list in the same change** — and if you cannot find
one that fits, that is usually a sign the title is still describing the office's work rather than the
resident's.

### 2. No office name in the title

This is the specific failure the vocabulary exists to prevent, and it is the one that keeps coming back —
because whoever writes the page has the office's PDF open in front of them.

**A resident does not know which office does the thing. Not knowing is why they came.** A title that leads
with the office answers a question nobody asked and hides the one they did.

**The enforced list, in full** — `namingRules.forbiddenInTitles` holds the authoritative copy, and a test fails
if this paragraph and that list stop agreeing:

`Office` · `Division` · `Bureau` · `Department` · `Unit` · `Municipal` · `Municipality` · `Sangguniang` ·
`ENRO` · `PESO` · `PEESO` · `MSWDO` · `MDRRMO` · `MEO`

`Municipal` and `Municipality` are on it deliberately, and they are the two that catch people out: _"Apply for
a municipal job"_ reads naturally and still fails. Write _"Apply for a local government job"_ — a resident
searching for work does not care which tier of government employs them, and the word was doing no work.

The office is recorded on the entry — `office.verbatim` and `office.canonical` — and it belongs in the page
body, on the office directory, and in search results as context. Never in the title.

> **`Mayor` is allowed, and that is a deliberate exception.** _"Mayor's Permit"_ is the actual name of the
> document a resident asks for by that name; it is a role and a document, not an office in the org-chart
> sense. `Mayor's Office` is not allowed. The distinction is narrow on purpose — if you find yourself arguing
> for a second exception, you are probably writing the charter's title back.

### 3. No acronym a resident would not recognise

`PSA` and `DOT` stay — people say them. `MTOP`, `SPES`, `RBO`, `PEESO`, `AUSF`, `CVAC`, `SECPA`, `COM`, `CFN`
do not: they are expanded, or dropped from the title and kept **verbatim inside the page**, where the
requirement they name is what the office will actually ask for.

The recognisable ones are listed in `namingRules.residentAcronyms`. Adding to that list is a claim about what
a resident in Tago already knows, so it needs a reason recorded beside it — not a build fix.

### 4. The words a resident would use

_"Close my business"_, not _"Business Retirement"_. _"Get a copy of a birth certificate"_, not _"Request for
PSA's Annotated Birth Certificate in Security Paper"_.

Where the charter's phrasing is genuinely the searched-for phrase, keep it — _"barangay clearance"_ is what
people say. The test is not "is it plainer", it is **"is it what somebody would actually ask for"**.

### 5. One task, one title — grouped, never merged

Several charter entries often answer one resident question. Two entries for registering a death; two for
transferring a patient; three for a business permit's life cycle.

**Group them. Do not merge them.** Each charter entry keeps its own record, its own `id` and its own source,
because each has its own fee, its own requirements and its own processing time — and merging two fee tables is
how a resident ends up paying the wrong amount. The group records only that one question spans several
services; `groups` in the vocabulary file declares it, and each member points back with `answers`.

### 6. Verbatim is preserved, never replaced

The resident title is what a page is **found** by. It is not a substitute for what the charter says.

Every entry keeps `charterTitle` exactly as published — including ALL CAPS, including the ones that trail off
mid-sentence. Office names, document names and fee names are recorded verbatim too, in `offices` and
`glossary`. Inside a page, those verbatim terms are what appear, because the office counter will ask for the
document by its own name and a helpfully-modernised one is a wasted trip.

**The charter is never silently corrected.** Where a document says something surprising — a `City` office in a
municipal charter, a number printed twice — the entry records the discrepancy as a note, in the document's own
words. Saying what a document says is a fact. Saying what it meant is an inference this project has not
sourced.

### 7. An internal service never gets a resident-task title

Every charter covers **external** services, which a resident can ask for, and **internal** ones, which are
government-to-government. An internal service published as a resident task would send somebody to a counter for
something they cannot request.

Internal services still get an entry — with `taskTitle: null` and a stated exclusion. **Silence is not the
same as a decision**, and a service missing from the file is indistinguishable from one nobody looked at.

## Adding or changing an entry

1. Find the service by `id` in `inventory/charter-services.yaml`. The `id` is stable; the charter's printed
   `number` is not — it repeats and skips.
2. Copy `charterTitle` **exactly** as it appears there. If the extractor could not read a title
   (`titleStatus: not-in-layout`) or it trails off mid-sentence, open the archived PDF under `sources/charter/`,
   read it, and set `charterTitleSource: read-from-pdf` so nobody later mistakes a human-supplied title for a
   published one.
3. Write the `taskTitle` against the rules above, and derive `slug` from it in kebab-case.
4. Record the office both ways — `verbatim` as printed, `canonical` from the `offices` roster.
5. If it answers the same question as another entry, add both to a group. Do not merge them.
6. Run `npm test -- task-vocabulary`.

## What review rejects

- A title that names an office, a division or a bureau. _(Rule 2 — the one this file exists for.)_
- A title that starts with a noun or a gerund. _(Rule 1.)_
- An acronym not on the recognisable list. _(Rule 3.)_
- A `charterTitle` that has been tidied, expanded, case-corrected or completed from context. _(Rule 6 — if it
  needed reading from the PDF, say so in `charterTitleSource`.)_
- Two charter services merged into one entry. _(Rule 5.)_
- An internal service carrying a `taskTitle`. _(Rule 7.)_
- A service in the inventory with no entry at all. _(Rule 7 — an omission and a decision look identical.)_

## No names

No person's name appears in the vocabulary, in these rules, or in a commit message. The charter's
`PERSON RESPONSIBLE` column is deliberately not captured. Refer to the **office**, or to the **role** — "the
Municipal Civil Registrar", "the Division Head". A name belongs in `content/` or `config/lgu.config.json`,
beside a source and a check date, where one change corrects it after an election.
