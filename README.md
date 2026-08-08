# BetterTago

**A community-led, open-source civic information portal for the Municipality of Tago, Surigao del Sur.**

> **BetterTago is an independent, volunteer-run project.** It is not operated by, endorsed by, or affiliated
> with the Municipal Government of Tago. **It is not a replacement for the official municipal site** —
> <https://tago.gov.ph> is the official record, and this project defers to it throughout. Where the two ever
> disagree, the official site is right and this project is wrong.

---

## What this is

The Municipality of Tago already publishes its Citizen's Charter, its office structure, and its news. The
problem is not that the information is missing — it is that the information a resident needs in order to _do_
something is locked in a format they cannot use: nineteen PDF files, one per office, organised by government
structure rather than by what a resident is trying to accomplish.

**This project's job is narrow: not to duplicate the official site, but to make what it already publishes
findable.** One web page per _task a resident wants to complete_, searchable, readable on a low-end phone over
a slow connection, in English and Filipino, each page citing and linking back to the official document it was
drawn from.

**What it is not:** the official site, a rival, a transaction system, a news outlet, a complaints channel, or a
politics site.

## Current status

**Scaffold only.** The platform stands, the quality gate runs, and one honest holding page is served. There is
no content, because the municipality has not yet been asked for permission to republish its charter — and this
project does not build first and ask later.

`content/` is empty on purpose. See [`content/README.md`](content/README.md).

## The rules that govern the content

Two of them do most of the work, and both are enforced by code rather than by review:

- **Cite or don't publish.** Every published fact carries a source, a link where one exists, and the date a
  human last checked it. `src/lib/content-schema.ts` makes all three non-optional.
- **A labelled gap is honest; a silent omission looks like concealment.** Every municipal fact this project has
  not obtained sits as `null` in `config/lgu.config.json` with a matching entry in `pending` saying what is
  missing and how it gets closed. A null with no entry fails the build. So does an entry that no longer
  describes a gap.

Everything else — verification levels, the transcription rules, the eight-field service guide, the bilingual
policy — is in [`docs/coding-standards.md`](docs/coding-standards.md) and
[`content/README.md`](content/README.md).

## Stack

Node 24 · TypeScript 5.9 strict · **Next.js 16.2** (App Router, Turbopack, `cacheComponents`) · React 19.2 ·
Tailwind CSS v4 + `@bettergov/kapwa` · `next-intl` (EN/FIL) · `react-markdown` + `remark-gfm` + `js-yaml` ·
Zod · Vitest + Testing Library · Playwright + `@axe-core/playwright`.

**Version ceilings — never install these at `latest`:** TypeScript stays on 5.9.x, ESLint on 9.x,
`lucide-react` on 0.577.x. Reasons in [`docs/coding-standards.md`](docs/coding-standards.md).

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev            # → http://localhost:3000  (redirects to /en)
```

E2E needs browsers once:

```bash
npx playwright install chromium
```

## The quality gate

All five must pass before a commit. `next build` does **not** lint in Next.js 16 and `next lint` has been
removed, so linting is always its own step — a green build is not a green lint.

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:e2e
```

**Don't run all five after every edit while building.** Run what the change touches — `npm test -- <pattern>`,
`npx playwright test e2e/<file>`, `npm run typecheck` when a type or route signature moved. Scoping while
building is not the same as narrowing the gate; the gate itself is never narrowed and never `--no-verify`'d.

## Layout

```
config/lgu.config.json   Municipality identity + the gap register. Read only through src/lib/lgu-config.ts
content/                 ALL page copy — markdown bodies + index.yaml manifests. Empty until Phase 1
messages/                UI strings for next-intl (en.json, fil.json) — NOT page body copy
docs/                    Coding standards, and the source notes behind every citation
brand/                   Mark assets
src/
  proxy.ts               Locale negotiation (Next 16's name for middleware.ts). MUST live in src/
  app/[locale]/…         Routes. sitemap.ts robots.ts
  components/{layout,ui} Chrome, and generic primitives
  i18n/                  next-intl routing + request config
  lib/                   content.ts (the only module that reads the filesystem), lgu-config.ts, utils.ts
e2e/                     Playwright specs — mirrors routes
```

**Two boundaries the review checklist enforces:** `src/lib/content.ts` is the only module that touches
`node:fs`, and `src/lib/lgu-config.ts` is the only module that reads `config/lgu.config.json`. No municipality
name, phone number, coordinate, or domain is hardcoded in a component.

## Contributing

Corrections are the most valuable contribution here, and **no contributor needs to touch code** — see
[`CONTRIBUTING.md`](CONTRIBUTING.md). If something on this site is wrong, tell us what it should say and where
you saw the right version. A photograph of a posted notice, with a date, is a genuinely valuable contribution.

**A correction from the Municipality of Tago outranks everything else in the queue** — fixed first, discussed
after. If the municipality asks for something to be removed, it comes down while we discuss it.

## Licence

Code: MIT, see [`LICENSE`](LICENSE). Content transcribed from official municipal documents remains the
municipality's, is republished with attribution, and links back to the original on every page.
