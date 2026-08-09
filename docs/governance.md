# Governance

**How this project decides that something is true, who does what, and how a resident corrects us.**

This file is the single place the verification standard, the roles, the contributor path and the record of what
we have asked the municipality are written down. Where a shorter summary elsewhere in this repository disagrees
with this file, **this file is right** — the summaries exist to point here, not to restate it.

It is deliberately short enough to read in one sitting. Nothing in it requires an engineering background.

---

## 1 · The verification standard

BetterTago restates a municipality's own published record. A restatement without a source and a check date
beside it is a rumour with better typography, so every published fact carries three things — a **source**, a
**verification level**, and a **check date**. `src/lib/content-schema.ts` makes all three non-optional; there is
no shape of content that renders without them.

### The four levels

| Level  | What it means                                                                    | A worked example                                                                                                                                                                                                                                  |
| ------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **V3** | **Verified primary.** An official municipal or national record, linked and dated | The Citizen's Charter PDFs published on the official municipal site, retrieved on a recorded date and archived with a checksum so a later revision is _detectable_ rather than assumed. **This is what the whole inventory is built from today.** |
| **V2** | **Official communication.** From an office directly, dated and archived          | A written reply from a municipal office stating its opening hours. **We hold none of these.** Nothing has yet been asked of any office                                                                                                            |
| **V1** | **Corroborated indirect.** Two independent secondary sources that agree          | Two unrelated published sources giving the same barangay count, where neither the municipality nor the statistics agency publishes one. **Nothing is published at V1 today**                                                                      |
| **V0** | **Unconfirmed.** One uncorroborated report                                       | A phone number a resident tells us rings the disaster office. **Nothing is published at V0 today**                                                                                                                                                |

The examples are honest about which levels this project actually holds material at, which is currently one of
them. A standard that describes a project we are not is a standard nobody applies.

### Which level is good enough for what

- **Fees, deadlines and requirements need `V2` or better.** These are the facts a resident acts on — they
  travel to a counter with money and a folder because of what we printed.
- **`V1` is not permitted on a fee, a deadline or a requirement.** Not as a stopgap, not "until we can confirm
  it", not behind a label. Two secondary sources agreeing is how a fee that changed in 2019 stays alive on ten
  websites. If we only have `V1`, we publish that the service exists and link the official document, and we do
  not state the figure.
- **Everything else** — an office's mandate, a location, a description of what a service is for — ships at `V1`
  or better.
- **`V0` ships only for safety-critical information**, only while it is **visibly labelled** as unconfirmed,
  and only on a 90-day re-check.

### What a level means on a recorded ABSENCE

The four levels above describe how well a fact is stood up. **A transparency register entry marked
`not-located` is not a fact about the municipality — it is an observation this project made**: that a document
was not at a named address on a named date. No official record says a document is unpublished, so the levels
need reading rather than applying.

**The level describes the check, not the document.** `V3` on a `not-located` entry means the absence was
observed **first-hand at the primary location**, dated, and repeatable by anyone who opens the same address —
which is the strongest footing an absence can have. It does **not** mean an official record states the
document is missing, and nothing in this project should be read as claiming that.

Two things follow, and both are enforced rather than trusted:

- **An entry cites a place it actually checked.** A `not-located` record's `source` must be one of the
  addresses in its own `lookedFor` list. Citing a page nobody looked at would make the level meaningless.
- **`lookedFor` carries the dates.** The level says how the looking was done; the list says where and when.

### The 90-day re-check, and what happens when it lapses

A `V0` fact carries the date it was last checked. **At 90 days without a re-check it comes off the page.**

Not a stronger warning, not a greyed-out row — removed. `V0` means nobody confirmed it; a fact nobody confirmed
and nobody has looked at in three months is a guess with a date on it. Removing it does not leave a hole,
because the gap surface renders the absence honestly and says what has been asked. **A wrong number in an
emergency is worse than no number at all**, and that rule does not weaken because the number has been up for a
while.

### The two-person rule

**Whoever collects a fact never verifies it.** A second person checks it against the source before it ships.

This is the rule that does the most work in the whole standard, and it is the one most tempting to skip when
there is one person available and a page nearly finished. A transcription error in a fee is indistinguishable
from a lie to the person who paid it, and the person who made the error is the person least able to see it.

**It applies to the record, not to the level.** A charter PDF from the official site is `V3` because of where it
came from; the second-person check is about whether what we typed matches what it says. Both are required, and
neither substitutes for the other.

### The verification record — what makes the rule checkable

A rule that is only written down is a promise. This one is a property of the data:

```ts
// src/lib/content-schema.ts
verificationRecordSchema; // { collectedBy, verifiedBy, verifiedAt }
```

- `collectedBy` and `verifiedBy` are **contributor handles** — a self-chosen identifier, lowercase and
  hyphenated, matching the same pattern a page slug uses. The pattern **cannot express a personal name or an
  email address**, which is deliberate: see [§3](#3--the-contributor-path).
- **A record whose `collectedBy` equals its `verifiedBy` fails to parse.** Not a review comment, not a warning —
  the content does not load. The reasoning is the same one that governs sources: the mistakes worth preventing
  are the ones a tired reviewer waves through at the end of a long page.
- `verifiedAt` is the date the second person checked it, in ISO form.

The record is **required on every service guide**, which is where fees, deadlines and requirements live. Where
the guide record is defined, it carries this record as a mandatory field.

### Corrections

**A correction is an ordinary change, not an embarrassment.** It gets a commit like anything else, and nobody is
asked to explain themselves for filing one. A project that treats being wrong as a failure gets fewer
corrections, not fewer errors.

**A correction from the Municipality of Tago goes to the front of the queue** — fixed first, discussed after,
the same day. If the municipality asks for something to be removed, it comes down while the conversation
happens. Being right matters less than being trustworthy.

---

## 2 · The roles

**Roles, not people.** Assignments are recorded as roles because roles are stable and the people holding them
are not, and a name in a project document outlives the person's involvement in it. **No document in this
repository names a person.** Names belong in `content/` and `config/lgu.config.json` — beside a source and a
date, where a single change corrects them after an election — and nowhere else.

**Every role below is open to residents of Tago.** Most need no code account, no engineering, and no prior
involvement.

| Role                    | What it owns                                                                                      | What it actually requires                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Project lead**        | Where the project is going, and saying no. Owns the standing offer to the municipality            | Judgement and follow-through. Not a technical role                             |
| **Transcriber**         | Turning an official document into a page, exactly — no rounding, no modernising, no tidying       | Care, patience, and the discipline to leave an ambiguity visible               |
| **Verifier**            | Checking a transcription against its source before it ships. **Never their own**                  | A second pair of eyes and the willingness to send work back                    |
| **Office liaison**      | Every request to a municipal office, and the record of it. Courteous, single-item, logged         | Writing well and following up. The single most valuable non-code skill         |
| **Field checker**       | What is actually posted on a wall, and whether a number rings. Photographs a notice with its date | Being in Tago, and a phone camera                                              |
| **Translator**          | The Filipino side of every string and every page, genuinely translated rather than copied         | Fluency, and knowing when a term of art should stay in English                 |
| **Content reviewer**    | The last read before a page ships: does it answer the question a resident actually arrived with?  | Reading as a resident, not as an author                                        |
| **Platform maintainer** | The code, the build, the accessibility floor, the dependency ceilings                             | Next.js and TypeScript. The only role that needs an engineering background     |
| **Maintenance owner**   | The review cadence — the thing that decides whether any of the above stays true a year from now   | Turning up repeatedly. The role most often unfilled and most costly when it is |

### The pair that must never be one person

**Transcriber and verifier, on the same page.** One person may hold several of these roles — most volunteer
projects run that way and this one is no exception — but never those two on the same piece of content. The
verification record makes a violation visible rather than merely forbidden: two identical handles will not parse.

### Who holds them today

**Every role above is currently vacant except platform maintainer and project lead.** That is recorded here
rather than absorbed silently, because an unowned review cadence is a cadence that stops running, and a role
list with no vacancies marked in a one-contributor project is not a role list — it is a wish.

**The consequence, stated plainly: with the verifier role vacant, no transcribed page can ship.** The two-person
rule is not waived because there is one person; it means the transcription work waits. This is a real
prerequisite, not a nicety — **recruiting a second person to verify is what unblocks the charter pages**, and it
is worth knowing now rather than discovering it with a dozen pages half-written.

What is _not_ blocked: the searchable index of which services exist, which office provides each one, and a link
to the official document. That shape needs no transcription and no second verifier, and it is most of what
residents currently lack. **That index is now complete** — 21 office records, and a record for **every one of
the 99 external services** the enumeration found, each citing the charter document it came from and each joined
back to the frozen vocabulary by a stable id.

**So the vacancy now has a number attached to it.** Ninety-nine records exist and **not one carries a
verification record**, because with one contributor none honestly can — `verificationRecordSchema` rejects a
record naming the same handle twice, and a test asserts that none has appeared. That is what holds `CONT-201`
through `CONT-209` and `CONT-212` at partial rather than done.

**The first task attached to filling the verifier role is therefore concrete:** open a charter PDF, open the
page beside it, and confirm four things — the service is real, the office is right, the document linked is the
one it came from, and the title is not something this project invented. That is a job for an afternoon and a
browser, it needs no engineering background, and it closes nine tickets.

### What the vacancies are actually holding up, as of 2026-08-09

Two roles are blocking specific, named work. Recorded here as a list rather than as a feeling, so that filling
a role has an obvious first task attached to it.

**Field checker — nothing on this list can be done from a computer.** Every item needs somebody in Tago.

| Record                                  | What has to be checked                               | Where it is                                                                                |
| --------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| The municipal hall's published landline | Ring it. Does it answer, and is it the hall?         | `config/lgu.config.json` → `contact.municipalHall.phone`, currently `published-unverified` |
| The municipal hall's address            | Is the hall where the contact page says it is?       | `contact.municipalHall.address`                                                            |
| Office hours, every office              | Photograph what is posted on the door, with the date | 21 office records, all currently a dated _not stated_                                      |
| Which room each office occupies         | The office records say the hall and no more          | 21 office records — **and 99 service pages now repeating that same address**               |
| Any emergency number                    | Whether it rings, and what hours it is staffed       | Nothing to check yet — none has been found                                                 |

**Until that list is worked, nothing on it ships as though it had been checked.** Today that costs nothing,
because no route renders any of it. It stops being free the moment one does.

**The statistics worklist — a browser, and ten minutes per figure.**

Nine municipal figures are still `null` for one reason: **the national statistics authority answers an
automated request with HTTP 403.** Not a login, not a robots rule — three separate attempts on 2026-08-09,
against the PSGC record, the site root and the population pages, all refused. A person opening the same address
in a browser is not refused, and that is the whole of what is missing.

| Figure                                                           | Where it is stated                                                                                                         | What to record                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Legislative district · PSGC code · income class · barangay count | The authority's PSGC record for this municipality — the address is in `config/lgu.config.json` under `pending['lgu.psgc']` | The value, the page's own release/edition, and the date you read it      |
| Population · households · census year                            | The authority's census release for this municipality                                                                       | The value **with its census year** — a figure without one is not citable |
| Land area                                                        | The authority's record, or the issuance it cites                                                                           | The value and the issuance that states it                                |
| Coordinates                                                      | The authority's record                                                                                                     | Needed before any map, and before per-barangay hazard can be looked up   |

🔴 **The one thing that must not happen.** An aggregator site was reachable on the same sweep and was
deliberately **not read** — this project did not check whether it carries these figures, because it could not
use them either way. Looking would take thirty seconds, and using what it found would be the exact failure this
project exists not to commit: a plausible number, with this portal's name on it and no way for a reader to tell
where it came from. **If the authority refuses, the figure stays null.**

The income classification is the one figure that closed this way round: the municipality states it on its own
tourism page, so it is recorded from there with that citation — and the national issuance that _set_ it is
still outstanding, which the register says beside the value rather than leaving implied.

**Translator — the Filipino side is a draft, not a publication.**

The bilingual policy is explicit that machine output is a draft and never a publication, and that procedural
copy is rewritten for meaning by a fluent speaker. **No Filipino in this repository has been reviewed by one.**
What exists is a careful draft, and it is listed here rather than left to be assumed:

| Filipino text                                        | State            |
| ---------------------------------------------------- | ---------------- |
| `messages/fil.json` — the whole shell string set     | Unreviewed draft |
| `content/**/*.fil.md` — **all 155 pages**, every one | Unreviewed draft |

**Coverage is 100% and review is 0%, and those are two different numbers.** CONT-402 translated every remaining
page; not one has been read by a fluent speaker. So that a reader is never misled by a page that looks
finished, **every Filipino page carries a notice on its own face** saying it is an unreviewed draft, and a test
fails the build if one does not. The notice comes off a page when somebody reviews that page — deliberately,
one page at a time, in a diff somebody reads.

Service titles inside the Filipino pages are **deliberately left in English**, because they are the words on the
form and at the counter. That is a translation decision, not an omission, and it is the same rule that keeps
fees, document names and office names untranslated.

---

## 3 · The contributor path

**The most valuable contribution here is a correction, and it does not require touching code.**

### What a useful correction contains

Two things: **what is wrong, and where you saw the right version.** A photograph of a posted notice, with the
date you took it, is a genuinely valuable contribution and is treated as one. You do not need to be sure. "The
fee at the counter was different from your page, here is the photo" is exactly the report we want.

### Where it goes

The published channel is the project's issue tracker, linked from the footer of every page and recorded in
`config/lgu.config.json`.

> **A gap in this, stated rather than hidden.** Opening an issue needs a free account on a code-hosting site,
> which is a real barrier for exactly the resident most likely to spot a wrong fee at a counter. **There is no
> second channel yet.** That is a shortcoming of this project, not of the person who cannot use the first one,
> and it stays written down here so it does not quietly become normal. Closing it needs an address that exists
> and someone reading it — it does not need any code.

### What happens to it

A contribution enters the workflow at the same point as anything else and passes the same gates:

```
report / transcribe  →  verify (a second person, against the source)  →  content review  →  ships
```

There is no fast path and no separate queue for outside contributions — the same two gates, in the same order.

**A resident report is labelled until it is confirmed.** It enters at `V1` or `V0` and stays there until an
office or an official document confirms it, and it is never presented as official in the meantime. **A fee, a
deadline or a requirement never ships from a resident report alone** — those need `V2` or better, which means an
office or a document, not a recollection. This is not a judgement about residents; it is the same floor that
applies to everything, including our own transcription.

### What we never ask for

**No personal information is collected, published, or required in order to contribute.** Not a real name, not an
address, not a phone number, not a barangay. The verification record uses a self-chosen handle whose format
cannot express a name or an email address, so the rule is enforced by the schema rather than by remembering it.

If you want credit, a handle is credit. If you would rather not be credited at all, say so and you will not be.

---

## 4 · Talking to the municipality

### The request log

Every request this project makes of a municipal office is written down **before it is sent**, and its answer is
written down beside it. Without that, _"we asked and they did not answer"_ is an unverifiable claim, and this
project does not publish claims it cannot support.

| Sent | Office               | Channel | Item asked for                                                                                                                                | Response         | Response date |
| ---- | -------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------- |
| —    | Municipality of Tago | —       | **The introduction: who this project is, that it is independent, and the standing offer of content, translations and source code at no cost** | **Not yet sent** | —             |

That is the whole log. One item, unsent — and it is the only thing standing between this project and its first
public route. See [§5](#5--the-phase-0-positions-and-the-gate).

**Offices are recorded by office, never by person.** The log records who a request went to as an institution.

### The correspondence discipline

- **One item per request.** A bundled request is easy to leave unanswered, and a partial answer to it is hard to
  record honestly.
- **Short and courteous.** An office that receives a request from this project should find it easy to say yes to
  and easy to ignore without consequence.
- **Logged before it is sent.** A request made outside this log did not happen as far as this project can prove.
- **Never published without the office's agreement.** We record that we asked and what came back; we do not
  publish an office's correspondence.

### The follow-up cadence

| Request type                                                                              | First follow-up | Second follow-up | Then                                                                                                                                                            |
| ----------------------------------------------------------------------------------------- | --------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Safety-critical** (emergency numbers, anything a resident could be hurt by not knowing) | 14 days         | 30 days          | Recorded as outstanding, and the same request goes to the service directly — the disaster office, the police, the fire service — each logged as its own request |
| **Permission** (whether we may republish something)                                       | 30 days         | 60 days          | Recorded as outstanding. **Silence is not consent** — the restrictive reading stands until an answer arrives                                                    |
| **Ordinary information** (hours, lists, documents)                                        | 30 days         | 60 days          | Recorded as outstanding, and the gap is published as a gap                                                                                                      |

**Two attempts, then it rests.** A follow-up is a fresh, courteous, single-item request that says what was asked
and when — not a chase, not a reminder of an obligation. After the second, the request is recorded as
outstanding **with the date of every attempt**, and we stop asking. It can be raised again when there is a
reason to, not on a timer.

**Follow-up never escalates into public pressure.** This project is not a complaints channel, not an oversight
body, and not a campaign. An office that has not answered is busy, and behaving as though it were anything else
would cost the cooperation this project runs on — which is the cheapest asset it has and the hardest to get back.

### How an absence is described — the language rule

This is a publication rule, and it binds every page, every interface string, and every entry in the gap
register:

> **An outstanding or unobtainable fact is never described as a refusal, a concealment, or a lack of
> transparency.**

"Requested on this date, not yet answered" is a fact. "Not published anywhere we can cite" is a fact. "They are
withholding it" is an inference about intent that this project cannot support and has no business making. The
difference matters even when nobody is reading, because it is the difference between a record and an accusation.

A test in `src/lib/guardrails.test.ts` scans the gap register, the interface strings and the content tree for
those three framings and fails the build on them. It is phrase-matched rather than word-matched — _refuse
collection_ is a real municipal service — and it carries a defended exemption list, not a broad one.

---

## 5 · The Phase 0 positions, and the gate

Phase 0 is where this project decides whether it may proceed, and on what basis. Each position below is settled,
dated, and recorded here so a future contributor cannot re-open it by assumption.

### Permission: index-and-link-only · settled 2026-08-09

**This project publishes that a service exists, which office provides it, and a link to the official document.
It does not republish the text of the Citizen's Charter.**

The charter is a public document produced to be read by the public, and that does not by itself mean this
project may reproduce its contents. Rather than proceed on an assumption or wait on an answer nobody has been
asked for, the project takes the shape that **needs no permission at all** — the index residents currently lack,
built entirely from what the official site publishes, with every entry linking back to the original.

**What would re-open it:** a written permission to transcribe and republish with attribution. Until then the
transcription work is not "pending" — it is out of scope, and the pages are built without it.

### Emergency information: the gap is published · settled 2026-08-09

No municipal emergency hotline is published on the official site. **The emergency surface renders that absence
rather than a number.** It will not carry a neighbouring municipality's number, a number from an undated list,
or a plausible-looking guess.

This is the settled position, not a temporary state pending an answer. If numbers are obtained later they are
recorded with the office that supplied them and the date, and the surface changes then.

### The point of contact · settled 2026-08-09

A **role** — office liaison, per [§2](#2--the-roles) — and a **channel**, the issue tracker recorded in
`config/lgu.config.json` and linked from the footer of every page. Both exist. The channel's known limitation is
stated in [§3](#3--the-contributor-path) rather than papered over.

### 🔒 The gate: **OPEN**, as of 2026-08-09

**No public route ships while this is open. Neither does the domain begin to resolve** — beyond the single
holding page that says what this project is, links the official municipal site, and never looks official.

Four of the five things this gate checks are settled: the record of what has been asked exists, the permission
position is settled, the emergency position is settled, and the point of contact exists as a role and a channel.

**The fifth is not, and it is the one the gate exists for: the municipality has not been told this project
exists.**

A portal about a municipality's public services, appearing without warning, is a claim on that municipality's
civic information space made before anyone there was spoken to. Building first and asking later is the specific
thing this project is designed not to do — not out of caution, but because a cooperative office is the cheapest
asset available here and an unannounced portal is how you make one defensive.

**What closes it:** the introduction in the log above, delivered. One letter, stating plainly that this is an
independent volunteer effort not affiliated with and not acting on behalf of the municipality; crediting the
municipality for publishing its charter at all, which is why any of this is possible; and making the standing
offer — content, translations and source code, at no cost and with no conditions — at first contact rather than
holding it back.

**The gate closes on delivery, not on a reply.** The requirement is that the project is not a surprise. Waiting
for an answer would hand a silent inbox a veto over a volunteer project, which is neither reasonable nor
something the municipality asked for.

---

## Where the shorter versions live

| File                       | What it carries                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `CONTRIBUTING.md`          | The front door — how to report a correction, and what a contribution needs. Points here for the standard           |
| `docs/coding-standards.md` | The rules that bite while writing code: what the schema enforces, and the gap register. Points here for the levels |
| `docs/sources/README.md`   | What a source citation records                                                                                     |
| `content/README.md`        | The shape of a page, and the eight questions a service guide answers                                               |
