# Contributing to BetterTago

**The most valuable contribution here is a correction, and it does not require touching code.**

If something on this site is wrong — a fee, a requirement, an office's hours, a phone number that does not ring
— tell us what it should say and where you saw the right version. A photograph of a posted notice, with the
date you took it, is a genuinely valuable contribution.

**You do not need to be sure.** _"The fee at the counter was different from your page, here is the photo"_ is
exactly the report we want.

**Where to send it: [open an issue](https://github.com/BetterTago/better-tago/issues).** That is the channel
linked from the footer of every page, and it is the one we watch.

> **A gap in this, stated rather than hidden.** Opening an issue needs a free account on a code-hosting site,
> which is a real barrier for exactly the resident most likely to spot a wrong fee at a counter. There is no
> second channel yet. That is a shortcoming of this project, not of the person who cannot use the first one,
> and it is written down here so it does not quietly become normal.

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
2. **A verification level**, `V3` to `V0`. The four levels, a worked example of each, and which level is good
   enough for what are in [`docs/governance.md`](docs/governance.md) — **read them there before choosing one.**
   The short version, which is not a substitute: **fees, deadlines and requirements need `V2` or better, and
   `V1` is never enough for those three.**
3. **A check date** — the day a human last looked, not the day the page was written.

And two rules about how it is written down:

- **Never round, simplify, or modernise a figure.** The exact figure from the source, with its source.
- **Where the source is unclear, say so on the page** and link it. Do not resolve an ambiguity by guessing.

**Whoever transcribes a page does not verify it.** A second person checks it against the source before it
ships. A transcription error in a fee is indistinguishable from a lie to the person who paid it. This is not
only a rule — the content schema rejects a page whose collector and verifier are the same handle.

Your contribution takes the same path as everyone's, with no fast lane and no separate queue:

```
report / transcribe  →  verify (a second person, against the source)  →  content review  →  ships
```

**A resident report is labelled until it is confirmed** — it enters at `V1` or `V0` and stays there until an
office or an official document confirms it. That is the same floor our own transcription meets, not a judgement
about who reported it.

**We ask for no personal information, ever.** Not a real name, not an address, not a phone number. If you want
credit, a self-chosen handle is credit; if you would rather have none, say so and you will not be named.

Who does what — all nine roles, which are open (most of them), and which two may never be the same person —
is in [`docs/governance.md`](docs/governance.md).

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
