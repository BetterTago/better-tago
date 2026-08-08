# Contributing to BetterTago

**The most valuable contribution here is a correction, and it does not require touching code.**

If something on this site is wrong — a fee, a requirement, an office's hours, a phone number that does not ring
— tell us what it should say and where you saw the right version. A photograph of a posted notice, with the
date you took it, is a genuinely valuable contribution.

**A correction from the Municipality of Tago outranks everything else in the queue.** Fixed first, discussed
after. If the municipality asks for something to be removed, it comes down while we discuss it. Being right
matters less than being trustworthy.

---

## What we will and will not publish

| We publish                                                                      | We do not publish                                              |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Office names, mandates, addresses, hours                                        | Any resident's personal information                            |
| Institutional phone numbers and official email addresses                        | A private individual's mobile, home address, or personal email |
| Position titles, and the office-holder's name **in the content layer**, sourced | Family details, or anything unconnected to the office          |
| Official municipal pages                                                        | Personal social-media accounts of officials                    |

**We will not** use another municipality's charter to fill a gap in Tago's. Fees and requirements differ
between municipalities, and a guide that is right somewhere else and wrong here looks complete and is false.
**We will not** publish an inference. "Requested, not yet answered" is a fact; "they are hiding it" is not.

## Content contributions

Every fact needs three things before it can ship:

1. **A source.** Where it came from — the official page, the charter PDF, a letter from an office, a photograph
   of a posted notice.
2. **A verification level.** `V3` official record · `V2` official communication · `V1` two independent
   secondary sources · `V0` unconfirmed. **Fees, deadlines and requirements must be V2 or better.** V0 is for
   safety-critical information only, and only while it is visibly labelled.
3. **A check date** — the day a human last looked, not the day the page was written.

And two rules about how it is written down:

- **Never round, simplify, or modernise a figure.** The exact figure from the source, with its source.
- **Where the source is unclear, say so on the page** and link it. Do not resolve an ambiguity by guessing.

**Whoever transcribes a page does not verify it.** A second person checks it against the source before it
ships. A transcription error in a fee is indistinguishable from a lie to the person who paid it.

## Code contributions

Read [`docs/coding-standards.md`](docs/coding-standards.md) first — it is short, and most review comments are
already answered there. The rules that come up most:

- **Server Components by default.** `'use client'` only at the interactive leaf that genuinely needs it, never
  on a `page.tsx` or `layout.tsx` to make a child work.
- **Named design tokens only.** A hardcoded hex or an arbitrary Tailwind value fails the build; the guardrails
  test scans for them. A colour with no token means the ramp is incomplete — extend `@theme`.
- **Adding a page must require no code change.** Markdown plus a manifest entry. If it needs a component, the
  route is wrong.
- **Accessibility is a gate, not a polish pass.** WCAG 2.1 AA, keyboard reachable, visible focus, 44 px touch
  targets, and an `@a11y` axe check on every route.
- **No named people outside `content/` and `config/lgu.config.json`.** Refer to the role.

### Before you open a pull request

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:e2e
```

All five, every time, and never `--no-verify`. If a pre-commit hook fails, fix the underlying issue.

**Conventional Commits**, enforced by commitlint: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`,
`perf:`, `build:`, `ci:`, `style:`. Content-only changes use a code type with a content scope
(`docs(content): add business permit renewal guide`); there is no `content:` type and commitlint will reject
one. Subject ≤ 72 characters. One change per commit.

Cut `feature/<slug>` or `fix/<slug>` from `main`, fast-forward before you start, and open the pull request
against `main`.

## Code of conduct

By participating you agree to [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). In short: this is a civic project
about a real place where real people live, and it is not a place for political argument about them.
