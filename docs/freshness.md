# Freshness — how a page goes stale, and who is meant to notice

**A fee transcribed correctly in year one is wrong in year three, and the page gives no sign of it.** That is
the risk this file exists for: not that something is wrong today, but that nothing in the system can tell.

The cadences live in one place — [`../config/freshness.config.json`](../config/freshness.config.json) — and
nothing else may hardcode one. The computation lives in `src/lib/freshness.ts`.

## The data classes

| Class             | Cadence   | Why that number                                                                                                                 |
| ----------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `emergency`       | 90 days   | The one class allowed to ship unconfirmed, and this is the price. Matches the `V0` re-check in [`governance.md`](governance.md) |
| `offices`         | 182 days  | Offices move on reorganisation, not on a schedule                                                                               |
| `charter-derived` | 365 days  | Charters are revised occasionally; the checksum watch catches a revision between reviews                                        |
| `transparency`    | 365 days  | Every `not-located` entry is a claim about a date, and a year-old claim needs re-looking rather than re-dating                  |
| `profile`         | 365 days  | Census and issuance cycles — and the nine unobtained figures get re-attempted on the same cadence                               |
| `tourism`         | 365 days  | Places open and close; the municipality's own list is what is being restated                                                    |
| `project`         | 365 days  | Copy this project wrote about itself                                                                                            |
| `history`         | 1825 days | The longest, deliberately. What can change is the page being summarised, not what happened in 1918                              |

**A page with no data class fails the build.** Not a warning, not a default — a page with no cadence never goes
stale, which is the exact failure this machinery closes and the one nobody would notice for years.

## Which section gets which class

Recorded here because it is a decision, not an obvious mapping — and because the next person adding a section
needs somewhere to look rather than a precedent to guess at.

| Content path                                                 | Class             |
| ------------------------------------------------------------ | ----------------- |
| `content/emergency/**`                                       | `emergency`       |
| `content/services/**` · `content/government/legislative*/**` | `charter-derived` |
| `content/government/offices/**`                              | `offices`         |
| `content/transparency/**`                                    | `transparency`    |
| `content/profile/**`                                         | `profile`         |
| `content/history/**`                                         | `history`         |
| `content/tourism/**` · `content/getting-here/**`             | `tourism`         |
| `content/home/**`                                            | `project`         |

`getting-here` is `tourism` rather than a class of its own: it restates the same page on the same cycle, and a
class with one page in it is a cadence nobody will remember to run.

## Immediate triggers

A cadence is a floor, not a schedule. Each class declares triggers that force it stale **that day**: a storm
warning, a charter revision, a reported change, an election. They are listed per class in the config.

`npm run charter:diff` is the first real caller: a Citizen's Charter document whose checksum has moved makes
every page derived from it stale immediately, and produces the work list of exactly which pages those are.

## 🔴 The rule that needs a mechanism, not a promise

> **A page is never made to look fresh by advancing its check date without somebody actually re-checking it.**

A check date moved without a check is a falsified record. It converts _"nobody has looked"_ into _"somebody
looked and it is still true"_ — a different claim, and a false one.

Prose cannot enforce that. This does:

- **`inventory/check-dates.yaml`** is a committed baseline of the date every page carried when it was last
  taken deliberately.
- **`lastReview`** on a manifest entry records the **role** that re-checked it and when. A role, never a handle
  and never a name — a review is about a job having been done.
- **A `lastCheckedAt` that moves past the baseline with no `lastReview` in the same change fails the build**
  (`src/lib/content-records.test.ts`).

The baseline is regenerated only by `npm run freshness -- --baseline`, deliberately, in a diff somebody reviews.
Regenerating it on every run would make the check agree with whatever was just typed.

## ⚠️ The computation exists twice, and that is pinned rather than ignored

`src/lib/freshness.ts` is the contract and is unit-tested against doctored dates. `scripts/freshness.mjs`
**re-implements the same thresholds inline**, because a `.mjs` script cannot import the TypeScript module —
and that script is the copy which writes the report a maintenance owner actually reads.

Two implementations of one rule drift, and this pair would drift **silently**: the report would go on looking
authoritative while disagreeing with the contract. So `src/lib/content-records.test.ts` recomputes every page
with `freshnessOf` and fails the build if the committed report disagrees with it — on the page count, the
manifest count, or which pages are listed as needing review.

**The real fix is one implementation**, in a `.mjs` core both sides import. Until that refactor is worth doing,
the check above is what makes the duplication safe rather than merely known. **If you change a cadence, change
it in `config/freshness.config.json` only** — neither copy hardcodes one.

## Where it stands today

**Nothing is stale, and no review has been recorded** — every page still carries the check date it was written
with, and `lastReview` is `null` on all of them. `npm run freshness` writes the report to
`inventory/freshness-report.md`.

⚠️ **Nothing is stale is a fact about age, not about care.** The first cadence to bite is `emergency`, at 90
days.

🔴 **A resident cannot see any of this yet.** The visible staleness notice a reader would get is `TAGO-104`'s
`StalenessNotice`, and no route renders anything. What exists is the contract, the computation and the report —
the half of ★ `TAGO-401` that does not need a renderer.

## Who owns it

The **maintenance owner** role, per [`governance.md`](governance.md) § 2 — **currently vacant.** An unowned
review cadence is a cadence that stops running, which is why the role is named and its vacancy recorded rather
than left to be discovered.
