# Coding Standards — BetterTago

Next.js 16 (App Router) · React 19 · TypeScript 5.9 strict · Tailwind CSS v4.

Match the majors already in `package.json`. Don't upgrade or pin to older majors without an explicit ask, and
don't change the framework, router, styling system, i18n library, content format, or test runners without one
either.

**Version ceilings — never install these at `latest`:**

| Package            | Ceiling | Why                                                                           |
| ------------------ | ------- | ----------------------------------------------------------------------------- |
| `typescript`       | 5.9.x   | `typescript-eslint` peers `>=4.8.4 <6.1.0`                                    |
| `eslint`           | 9.x     | `eslint-config-next` vendors `eslint-plugin-react`, which peers `eslint ^9.7` |
| `lucide-react`     | 0.577.x | `@bettergov/kapwa@1.4.1` peers `>=0.500.0 <1`                                 |
| `js-yaml`, `jsdom` | pinned  | Held by existing type packages; bump only with a typecheck                    |

---

## Runtime & language

- **Node 24** (`.nvmrc`), **npm** (lockfile `package-lock.json`).
- **TypeScript strict.** No `any` — use `unknown` and narrow, or a precise type. Types for every content shape,
  config object, and component prop.
- Prefer `satisfies` over type assertions. Use `import type` for type-only imports.
- **Path alias `@/*` → `./src/*`.** Use it for cross-directory imports; relative paths within a folder.
- **Validate at the boundary with Zod.** Anything parsed from YAML, markdown front-matter, JSON config, a route
  param, or an external API is `unknown` until a schema has proven otherwise. `z.infer` the resulting type
  rather than hand-writing a duplicate interface.

## Rendering — the single most important rule

- **React Server Components by default.** A component is a Server Component unless it declares `'use client'`.
- **`'use client'` only at the interactive leaf** that genuinely needs `useState`/`useEffect`/`useRef`, an
  event handler, a browser API, or a client-only library. Never on a `page.tsx` or `layout.tsx` "to make a
  child work" — that pulls the whole subtree into the bundle. (`error.tsx` is the one exception: Next requires
  error boundaries to be Client Components.)
- **Push the boundary down, pass data in.** Read on the server, pass plain serialisable props into the leaf. A
  Client Component may render server-rendered `children` passed through as props.
- Don't fetch on the client what the server could have rendered. `useEffect` + `fetch` on mount costs a round
  trip, a loading state, and the accessibility and SEO of real HTML.
- Use `<Suspense>` to stream a slow segment rather than blocking the page; `loading.tsx` for route-level
  fallbacks.
- Server Components can't use hooks, context, or event handlers; Client Components can't be `async` or read the
  filesystem. If you are fighting that, the boundary is in the wrong place.

## App Router conventions

- Routes are **folders** under `src/app/[locale]/`. File conventions: `page.tsx`, `layout.tsx`, `loading.tsx`,
  `error.tsx` (Client Component), `not-found.tsx`, `template.tsx`, `route.ts`. Route folders are kebab-case and
  match the URL segment.
- **No Pages Router, no `getServerSideProps`/`getStaticProps`, no `next/head`, no `react-helmet`, no React
  Router.**
- **Request APIs are async.** `params`, `searchParams`, `cookies()`, `headers()`, and `draftMode()` return
  Promises — always `await`.
- **Use the generated route types**, not hand-written prop interfaces:

  ```tsx
  export default async function ServicePage({
    params,
  }: PageProps<'/[locale]/services/[category]/[slug]'>) {
    const { locale, category, slug } = await params;
  }
  ```

  `PageProps` / `LayoutProps` / `RouteContext` are global; `npm run typegen` regenerates them after a route
  change.

- **Dynamic routes enumerate their pages** with `generateStaticParams`, sourced from the content manifests — so
  a new markdown page is prerendered with no code change.
- **A missing page calls `notFound()`.** Never render a "not found" message inside a 200 response.
- Every segment that can fail gets an `error.tsx` boundary. Keep it small and recoverable (`reset()`).
- Navigate with `next/link`; `useRouter` from `next/navigation`, never `next/router`.

## Caching & data loading

`next.config.ts` sets **`cacheComponents: true`** — nothing is cached implicitly.

- **Opt in with `'use cache'`** at the top of an async function, then declare lifetime and invalidation with
  `cacheLife()` / `cacheTag()` from `next/cache`.
- **Invalidate with `revalidateTag()`**, not by guessing a TTL.
- **Never use `unstable_cache`** — superseded by `'use cache'`.
- **Content reads should be cached.** `src/lib/content.ts` reads files that only change on deploy.
  ⚠️ **In development that cache does not notice a YAML edit** — `content/` is read at runtime, so it is not a
  module the bundler watches, and `cacheLife('max')` never expires. Restart `npm run dev` after a content
  change.
- **Live upstreams must be time-boxed** with `AbortSignal.timeout(...)` and a short `cacheLife`, and must
  **degrade to an empty state rather than throwing**. A third-party outage is not a page outage.
- Route Handlers under `src/app/api/` exist only for what a Server Component genuinely can't do. Don't create
  an internal API route to read `content/` — call the loader directly.

### Calling something outside this repository

Almost nothing here does. `content/` is files, `config/` is a file, and for most of this portal's life `src/`
contained **no `fetch` at all**. The first external call — the conditions strip, `TAGO-115` — is therefore also
the pattern, and `src/lib/weather.ts` is written to be read as one. **Copy its shape; do not invent a second.**

```ts
export async function getThing(): Promise<Thing | null> {
  'use cache';
  cacheLife('thing'); // a NAMED profile, declared in next.config.ts
  cacheTag('thing');

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return null;

    const parsed = schema.safeParse(await response.json());
    return parsed.success ? shape(parsed.data) : null;
  } catch {
    return null;
  }
}
```

Five rules, each with a specific failure behind it:

1. **Time-box every request** with `AbortSignal.timeout`. An upstream that never answers must never hold a
   render open.
2. **Validate at the boundary.** The body is `unknown` until Zod says otherwise. **A 200 with the wrong shape
   is a failure, not data** — that is the case a `response.ok` check misses, and the one that puts `undefined`
   on a civic page.
3. **Return `null`, never throw.** A DNS error, an abort and a schema mismatch are the same event to a reader:
   there is nothing to show. Every caller renders an empty state. **A third-party outage is not a page
   outage.**
4. **Name the cache profile in `next.config.ts`**, and give it an `expire`. `stale` / `revalidate` fix the
   upstream call rate to the clock rather than to readership; `expire` is the honest one — past it the value is
   not served at all, so a dead upstream cannot leave a stale number on the page looking current.
5. **Never let CI contact the upstream.** Mock at the `fetch` boundary in units and with `page.route()` in
   Playwright. A gate that depends on a third party goes red on a morning when nothing in this repository
   changed, and people learn to re-run it instead of reading it.

And one rule that is not about resilience at all: **if what you are rendering carries any authority a reader
might act on — weather, hazard, health, a fee — say where it came from and when, inline, and say what it is
not.** The conditions strip names its source, prints the time its reading was taken, and defers explicitly to
the national weather service, because forecast-model output sitting unlabelled on a civic portal in a
typhoon-exposed municipality reads as an official bulletin. That is a publication decision, and it belongs in
the component beside the data rather than in a review comment.

## Content pipeline

- **`content/` is the data layer, and `src/lib/content.ts` is the only module that reads it.** No component,
  page, or route handler touches `node:fs`.
- Category folders hold an **`index.yaml`** manifest plus one markdown file per page. **The YAML `slug` must
  match the markdown filename exactly** — otherwise the page 404s while the file sits there looking correct.
- Parse YAML with `js-yaml` and validate with Zod before it leaves the loader. Malformed content is a
  build-time error, not a runtime surprise.
- Markdown renders through `react-markdown` + `remark-gfm` with an explicit component override map. **No
  `rehype-raw`, no raw-HTML passthrough**, never `dangerouslySetInnerHTML` on content.
- **Adding a page must require no code change.** If it does, the route is wrong — fix the route.

### 🙅 No named people outside the data layer

**A person's name is DATA. It never goes into prose.**

Do not write the name of any person — an elected official, a department head, a barangay captain, a
contributor, a resident — into a document, a code comment, a commit message, a test fixture, or placeholder
copy. **Refer to the role**: "the Mayor", "the Vice Mayor", "the Municipal DRRM officer", "a maintainer", "a
resident contributor".

The **only** places a name may live are `content/**` and `config/lgu.config.json`, where it sits beside its
source and its check date, is rendered rather than asserted, and can be corrected by anyone with a content
change after an election.

Why it is a rule rather than a preference: an official's name written into a design note is an unsourced
political claim with no citation, no date, and no obvious place to fix it. The same name in `content/` carries
all three. Naming **organisations** (the Municipal DRRM Office, the municipal police station, the national statistics
agency, BetterGov.ph) is fine, as is a
historical figure that reaches the page through a cited record in `content/`.

## Internationalisation

- **`next-intl`** with an `[locale]` segment and **`proxy.ts`** for negotiation. Next 16 renamed
  `middleware.ts` to `proxy.ts`; don't create one. With a `src/` directory present it must live at
  `src/proxy.ts` — at the repo root it compiles to an empty middleware manifest and `/` 404s.
- **Two mechanisms, kept strictly apart:** UI chrome and labels → `messages/{en,fil}.json`; page body copy →
  markdown, with `<slug>.fil.md` beside `<slug>.md`.
- **No hardcoded user-facing strings in components.**
- **Missing FIL falls back to English with a visible banner.** Deliberate, and never silent. A key sitting in
  `fil.json` with an English value defeats it — the guardrails test carries a reviewed exemption list for the
  handful of loanwords and proper nouns that are legitimately identical.
- Locale-aware date and number formatting goes through `next-intl`'s formatters.

## Styling & design system

- **Tailwind CSS v4, configured in CSS** — `@import 'tailwindcss'` plus `@theme` in `src/app/globals.css`.
  ⚠️ **Never create `tailwind.config.ts` or `tailwind.config.js`** — those are v3, v4 ignores them silently, and
  a theme "change" that lands in one is a change that never happened. No JavaScript-based config.
- **Named tokens only.** `bg-primary-700`, `text-ink-secondary`, `gap-4`. **Hardcoded hex/rgb/hsl and arbitrary
  values (`bg-[#16643c]`, `text-[13px]`) fail the build** — `src/lib/guardrails.test.ts` scans for them. A
  colour with no token means the ramp is incomplete: extend `@theme`, don't inline a hex.
- **Three token layers.**
  1. **Raw ramps** (`primary`, `accent`, `neutral`) live in `@theme` and never change with the theme.
  2. **Semantic roles** (`--surface-page`, `--ink`, `--line-control`, `--focus-ring`) are declared on `:root`
     and on `:root[data-theme='dark']`, then exposed through **`@theme inline`** so a utility resolves them
     **at the element**. That is what lets `bg-surface-page text-ink` work with no `dark:` prefix anywhere.
     ⚠️ **`inline` is load-bearing**: a plain `@theme` bakes the light value onto `:root` and the dark theme
     silently does nothing — a failure that is invisible in light mode, which is the mode it gets reviewed in.
  3. **Surface scopes** — `[data-surface='inverse']` (any ground that is dark in _both_ themes) and
     `[data-surface='accent']` (the gold card) re-point the ink, line, focus and mark roles for everything
     inside them. A component on a dark slab never asks which theme it is in.
- **Semantic names, not literal ones.** `--color-primary-700`, not `--color-green-700`. The portal is
  re-pointable at another LGU by changing the ramp.
- **The palette is derived from BetterTago's OWN mark**, not from the municipality's identity, and the
  distinction is the whole point: `primary-300/500/700` and `accent-400` reproduce the emblem's three greens
  and its sun **exactly, unrounded**. `primary` carries a deliberate hue drift (~149° → 162.5°) because the
  deep green is 16° bluer than the other two and no single-hue ramp can hold all three. Independence from
  _municipal_ livery is unchanged and is stated in `portal.paletteNote`.
- **There are two accent inks and the split is not cosmetic.** `--ink-accent` (accent-700) is **3.67:1** on
  paper — display sizes ≥24px only. Body-size accent text must use `--ink-accent-strong`, which clears 4.5:1.
- **Contrast is verified by computation, not by comment.** `src/lib/theme-tokens.test.ts` reads the ramps and
  roles out of `globals.css`, resolves each role through `var()` the way a browser would, and computes every
  ratio — floor **and** recorded value. Move a ramp and the build goes red naming the pair. It also asserts
  every ramp is strictly monotonic in OKLab lightness.
- **The mark is the one exception to the ramp rule, and it now has two levels.**
  `--mark-delivered-{emblem-light,emblem-mid,emblem-deep,sun}` are the fixed artefact, in hex, never
  overridden. `--mark-*` are **roles** that resolve to the artefact on the page and to white inside
  `[data-surface='inverse']` — which is what lets one component render all three delivered variants instead of
  shipping three SVGs. `--color-accent-400` and `--mark-delivered-sun` hold the _same value_ and remain _two
  tokens_: a future change to the accent ramp must not reach the logo. **Don't fold them into the ramp, and
  don't add a fifth without a design sheet.** See [`brand/logo/README.md`](../brand/logo/README.md).
- 🔴 **The dark page ground's 16% lightness is a ceiling, not a preference.** The ground is green-tinted, so
  _lightening_ it reduces the emblem deep green's contrast against it rather than improving it. Any future
  lightening drops the mark further below 3:1 and needs either a lighter deep green or a documented exemption.
  A test asserts the direction so it cannot be "brightened a little" by accident.
- **The mark is inlined, never an `<img>`.** `src/components/ui/Logo.tsx` carries the geometry so its fills can
  come from those tokens. It takes a **required `idPrefix`** — its masks, clip path and `<use>` chain need
  document-unique ids and a Server Component cannot call `useId()`, so two instances sharing a prefix break the
  second one's masks while the first still looks right. It is always `aria-hidden`; the wordmark beside it
  carries the accessible name.
- **Prefer a `@bettergov/kapwa` component** over a bespoke one, and match its API shape when you do write one.
  Note that no Kapwa dist file carries `'use client'`, so its interactive components must be imported from
  inside one of our client leaves.
- Compose conditional classes with `cn()` (`clsx` + `tailwind-merge`) and variant sets with
  `class-variance-authority`. Don't hand-concatenate class strings.
- **Mobile-first, and the site must work at 320 px.** Wide content scrolls inside its own `overflow-x: auto`
  container — the page body never scrolls horizontally.
- Prose blocks use `@tailwindcss/typography`, not ad-hoc heading styles. Body text stays at a ~16px floor;
  civic information is read by people of every age.
- **Tailwind for all styling — no inline `style` attributes.** The one exception is a genuinely dynamic value
  that cannot be a token (a computed chart dimension), and it needs a comment saying why.
- **Lucide React is the only icon library.** Don't add a second one, and don't paste a raw SVG where a Lucide
  icon exists.
- **Light mode first, dark mode as an option.** The light palette is the design; dark is derived from the same
  semantic roles, never a separate set of hardcoded colours.
- `globals.css` declares `@source '../../node_modules/@bettergov/kapwa/dist'` so Tailwind scans Kapwa's
  compiled output. Removing that line silently drops Kapwa's styles from the build.

### Theming — the attribute, the pre-paint script and the toggle

- **`data-theme` on `<html>` is the switch**, bound through a custom variant declared **after** the
  design-system import. `prefers-color-scheme` alone cannot express _"the OS says dark, the reader chose
  light"_, which is why the attribute exists at all.
- 🔴 **`<html>` carries both `data-theme="dark"` and `class="dark"`, always** — because Kapwa's two
  stylesheets disagree. `dist/kapwa.css` binds its tokens to `.dark, [data-theme='dark']` and accepts either;
  `dist/index.css`, where the component utilities live, declares `@custom-variant dark (&:is(.dark *))`, which
  is **class only**. Writing one without the other leaves half the page in the wrong theme — exactly the half
  that a screenshot of our own components never shows. ⚠️ Neither file is imported yet (`globals.css` only
  `@source`s the dist for class names), so the class is inert today and becomes load-bearing the moment
  `index.css` is. **Reading only `kapwa.css` and deleting the class is the mistake this rule guards against.**
- **The resolved theme is written before first paint** by an inline script in the root layout, so no route
  renders in the wrong theme for a frame. That script also corrects `<html lang>` from the first path segment,
  because the root layout owns the document and is never re-rendered on a client-side locale switch.
- 🔴 **That script is the one and only permitted `dangerouslySetInnerHTML` in the app**, and it is safe for
  exactly one reason: it is a **static literal**. A unit test fails on the first interpolation, and a second
  fails if its hardcoded locale list drifts from `routing.locales`. **Do not make it take a parameter.**
- 🔴 **`src/lib/theme-init.ts` is the only module in `src/` that knows the attribute name or the storage key.**
  `ThemeToggle` calls into it and never touches `document`; the layout only imports the script string. A
  guardrail fails the build the moment a second file mentions either.
- **The toggle renders both icons and both accessible names and lets CSS choose.** Reading the theme in an
  effect paints the wrong icon and then flips it — the hydration mismatch the pre-paint script exists to
  prevent. It announces the new state through a polite live region _outside_ the button (inside, the region
  would become part of the button's own accessible name), and it keeps working when `localStorage` throws, as
  it does in private-browsing modes.
- 🔴 **No component carries a `dark:` colour utility.** Colour flips through the roles, at the element. A
  guardrail scan fails on the first one, because a component that branches on the theme has bypassed the layer
  the roles exist to be.
- **`color-scheme` is set per theme**, so form controls and scrollbars follow the page. There is deliberately
  no `<meta name="color-scheme">`: it would let the UA paint a dark canvas for a reader whose stored choice is
  light.
- **Known and accepted:** with JavaScript disabled the attribute is never written and the page renders
  **light**, whatever the OS says. That is the cost of a switch a reader can actually operate — the page stays
  fully readable either way, and a media-query fallback would reintroduce the split the `dark` class exists to
  avoid.
- **Both themes are a gate, not a preference.** Every route's `@a11y` check runs in both themes **and** both
  locales.

## Accessibility — a gate, not a polish pass

**WCAG 2.1 AA is the floor.** Every merged route must satisfy:

- **Semantic HTML first** — `<nav>`, `<main>`, `<header>`, `<footer>`, `<button>`, `<a>`, real headings in
  order. ARIA only where semantics genuinely fall short; a correct element beats a `role`.
- **Keyboard reachable** — everything interactive is tabbable, operable with Enter/Space, and has a **visible
  focus ring**. Never `outline: none` without a replacement.
- **Labelled controls** — every input has a `<label>`; every icon-only button has an accessible name that
  reflects its state.
- **Touch targets ≥ 44 × 44 px**, measured by `e2e/holding.a11y.spec.ts`. Exceptions are tracked in an
  explicit list rather than quietly dropped from the gate.
- **Contrast verified** against the `@theme` ramp — 4.5:1 body text, 3:1 large text and UI boundaries.
- **Images** carry meaningful `alt`, or `alt=""` when decorative. Charts carry a text alternative.
- **Motion respects `prefers-reduced-motion`.** Note that the CSS media query does not govern the JS scroll
  API — anything calling `scrollTo({behavior})` must read `matchMedia` itself.
- Every route ships an **`@a11y`-tagged Playwright check** using `@axe-core/playwright`.

Axe catches roughly a third of real accessibility problems. Tab through the page yourself before calling a
route done.

## SEO & metadata

- **Next.js built-ins only** — `export const metadata`, or `generateMetadata` for dynamic routes.
- Every page sets a unique title, description, canonical URL, and Open Graph card. Canonicals derive from
  `config/lgu.config.json`, never a hardcoded domain.
- **`src/app/sitemap.ts` and `src/app/robots.ts` are generated from the content manifests**, so a new page
  appears in the sitemap automatically.

## Configuration & environment

- **LGU identity lives in `config/lgu.config.json`** — name, coordinates, domain, brand colour, contacts,
  socials — read through one typed, Zod-validated `src/lib/lgu-config.ts`. **Never hardcode a municipality name, phone
  number, coordinate, or domain in a component.**
- **Secrets live in `.env.local`** (git-ignored). `.env.example` is the committed template.
- **Only `NEXT_PUBLIC_*` reaches the browser — never put a secret behind that prefix.**
- No hardcoded URLs or timeouts in components.

## Security

- Treat markdown, YAML, and any URL param as **untrusted**. Validate every route and search param.
- No raw HTML passthrough and no `dangerouslySetInnerHTML` — there is no exception. Adding one needs an
  explicit ask plus a unit test proving the string it injects contains no interpolation.
- No secrets in the client bundle. **No `console.log` in committed code.**

## Naming

React components PascalCase in PascalCase files (`ServiceCard.tsx`), **functional components only**;
non-component modules kebab-case (`lgu-config.ts`); hooks `use-*.ts` exporting `useX`; route folders kebab-case
matching the URL; functions camelCase; constants SCREAMING_SNAKE_CASE. Types PascalCase with no `I` prefix —
cross-feature shapes in `src/types/<feature>.ts`, local shapes stay local.

## Component structure — colocation, and the three tiers

A component's _location_ encodes how widely it is used. Getting that wrong is the most common way a component
tree turns into a flat grab-bag nobody can safely delete from.

**Never place a component at the root of `components/` if only one parent uses it.** The three tiers, narrowest
first:

| Tier               | Where                                                              | Promote to it when                                                                   |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Sub-component**  | Inside its parent's feature folder, or a named subfolder within it | Used by exactly one parent                                                           |
| **Feature-shared** | `_shared/` inside that feature folder                              | Reused by two or more components **within the same feature**                         |
| **Global shared**  | `components/ui/`                                                   | Reused **across multiple features**, and generic enough to carry no feature coupling |

A component moves outward only when the reuse is real and present — not because it might be reused later.
`_shared/` exists precisely so feature-wide reuse doesn't force a premature promotion to `components/ui/`.

```
src/components/
  ui/                        ← global shared: Container, Section, SkipLink, BackToTop
  home/                      ← a feature
    Hero.tsx
    _shared/                 ← shared within `home` only
      SectionHeader.tsx
    stats/                   ← related sub-components, grouped
      StatBand.tsx
```

- **Group related sub-components under a named subfolder** when a parent grows more than two or three of them.
- **Keep feature-shared components decoupled from any single parent** — if it only makes sense next to one
  caller, it isn't `_shared/`, it's a sub-component.
- **Keep global shared components generic.** A component in `components/ui/` that imports from a feature, or
  names one in its props, belongs back inside that feature.
- **Avoid unnecessary deep nesting.** Folder names describe the feature or domain, not the file type.

### Modals

Live in a `modals/` subfolder inside the feature that opens them. **Omit "Modal" from the filename only** —
`modals/AddContact.tsx` — and **keep it in the exported name**:

```ts
export function AddContactModal() {}
```

```ts
import { AddContactModal } from './modals/AddContact';
```

### Route structure mirrors the same idea

**Group sub-pages under their parent route folder.** If a page is conceptually a child of another page, it
lives inside the parent's folder — the URL and the filesystem agree, and the parent's `layout.tsx` applies
without a second thought.

```
src/app/[locale]/services/page.tsx              ✅  /services
src/app/[locale]/services/[category]/page.tsx   ✅  /services/health
src/app/[locale]/services-health/page.tsx       ❌  flat, and the layout doesn't nest
```

## Machinery this portal deliberately does not have

Four things a general Next.js product would reach for are absent here on purpose. Recorded so the difference
reads as a decision rather than an oversight — **don't introduce any of them without an explicit ask.**

| Absent                                                                   | Why                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A database / ORM** (Prisma, migrations, server components querying it) | `content/` is the data layer and `src/lib/content.ts` is the only module that reads it. A portal whose content is files in the repo is reviewable, forkable, and correctable by a non-engineer — that is the architecture, not a limitation to grow out of                  |
| **shadcn/ui**                                                            | `@bettergov/kapwa` is the component library. Prefer a Kapwa component over a bespoke one; match its API shape when you must write your own                                                                                                                                  |
| **Server Actions**, `{ success, data, error }` returns, toast errors     | The portal is public, read-only, and collects no personal data. **If an intake surface ever ships**, a Server Action is still the right mechanism — Zod-validated at the boundary, rate-limited, storing no resident personal data. It is not an excuse to add an API route |
| **API routes** for webhooks, uploads, long-running work                  | None of those surfaces exist. Route Handlers under `src/app/api/` are for what a Server Component genuinely cannot do — never to read `content/`                                                                                                                            |

### 🔴 Specs, tickets and design notes do not live in this repository

`docs/` holds guides for working **in this codebase**. It is not where a feature spec, a fix spec, a ticket, or
a design note goes — those are kept in the project workspace this repository is developed from, alongside the
other portal's, and they are **deliberately not mirrored here**. Do not create `docs/specs/`, `docs/tickets/`,
or an equivalent, and do not accept a bare instruction like _"write the spec to `docs/specs/<slug>.md`"_ at
face value: that path means the workspace's spec folder, not this one.

**The reason is enforced, not stylistic.** A spec cites tickets, sibling specs and the reference portal's
patterns, and no file in this repository may name a path outside it — anyone who cloned only this repo would
get a dead link. `src/lib/guardrails.test.ts` sweeps `docs/`, `inventory/` and `scripts/` **recursively** and
fails the build on the first outward path, so a spec filed here is either already broken or one citation away
from it.

What _does_ belong in `docs/`: this file, `governance.md`, `freshness.md`, `task-titles.md`, and the civic
citations under `docs/sources/` — all of them self-contained.

## Testing

- **Vitest** + Testing Library for units — the content contract in `src/lib/content-schema.ts`, the config
  invariants in `src/lib/lgu-config.ts`, utilities, component behaviour, and the source scans in
  `src/lib/guardrails.test.ts`. Note that `src/lib/content.ts` imports `next/cache` and therefore only resolves
  inside the Next runtime; that is why the schemas it enforces live in a separate framework-free module.
- **Playwright** for E2E — route renders, navigation, locale switch, 404, and accessibility. `e2e/` mirrors
  routes.
- Query by role or label, not by test id.
- A test that cannot fail is worse than no test. When you add a scan or a measurement, prove it catches a
  known-bad input before you trust it.

## The quality gate

All five must pass before a commit:

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:e2e
```

`next build` does **not** lint in Next.js 16, and `next lint` has been removed — linting is always its own
step. E2E needs browsers once: `npx playwright install chromium`.

⚠️ **On a fresh clone, run `npm run typegen` before `npm run typecheck`.** `PageProps` and `LayoutProps` are
globals Next generates into `.next/types/routes.d.ts`, which `next-env.d.ts` imports; `.next/` is git-ignored,
so on a clean checkout `tsc` fails with `Cannot find name 'PageProps'` while every source file is correct. It
passes on your machine only because a build has run there. CI runs `typegen` first for this reason.

**Don't run the full gate after every edit while building.** Run what the change touches:

| Situation                                               | Run                                |
| ------------------------------------------------------- | ---------------------------------- |
| Changed a loader, util, or component with unit coverage | `npm test -- <path-or-pattern>`    |
| Changed a route, navigation, or locale behaviour        | `npx playwright test e2e/<file>`   |
| Touched accessibility on a route                        | `npx playwright test --grep @a11y` |
| Changed types, props, or a route signature              | `npm run typecheck`                |

Scoping while building is not the same as narrowing the gate. The gate itself is never narrowed and never
`--no-verify`'d.

### Where it actually runs

`.github/workflows/ci.yml` runs all five on every pull request against `main`, and on every push to `main`.
Two jobs, split by cost: `checks` does typecheck, lint, format and unit; `e2e` installs Chromium, builds, and
runs Playwright.

**The E2E job runs against a production build, not `next dev`** — and that is not a preference. `next dev`
compiles each route on first request, which makes the suite both slower and less truthful, and
`cacheComponents` behaves differently between the two: a route that has silently stopped prerendering looks
perfect under dev and is only visible in a build. `playwright.config.ts` starts `next start` when `CI` is set
and `next dev` when it is not, so the same command means the right thing in both places.

Three things the workflow may never grow: `continue-on-error`, `--no-verify`, and a narrowed test selection. A
gate that can be talked round is not one. Everything in this section is enforced by the file itself and by
`src/lib/guardrails.test.ts`; neither is a convention.

⚠️ **Branch protection is a repository setting, not a file.** The workflow reports a failure; making that
failure _block a merge_ is a rule configured on the remote, and until it is, a red gate is advice.

## Branching, commits, versioning

- **`main` is the trunk.** Cut `feature/<slug>` or `fix/<slug>` from it and open the pull request against it.
  Fast-forward before you start — `git fetch origin` → `git pull --ff-only origin main`.
- **Conventional Commits**, enforced by commitlint on a `commit-msg` hook: `feat:`, `fix:`, `chore:`,
  `refactor:`, `docs:`, `test:`, `perf:`, `build:`, `ci:`, `style:`. Scope by area when it clarifies —
  `feat(services): …`. Content-only changes still use a code type with a content scope
  (`docs(content): add business permit renewal guide`); there is no `content:` type and commitlint will reject
  one.
- Subject ≤ 72 characters. A body only when the _why_ isn't obvious — never a file-by-file changelog.
- One feature or fix per commit. Let Husky and lint-staged run; do not skip hooks.
- **Versioning is SemVer**, with `package.json` `version` as the single source of truth (read through
  `src/lib/version.ts`, rendered in the footer):
  - **MAJOR** — the information architecture changed, or **any published URL stops resolving**.
  - **MINOR** — a new page, route, or page section ships.
  - **PATCH** — content, copy, translations, styling, accessibility, dependencies, no-op refactors.
  - One bump per completed feature or fix, in the same commit as the work. Stay on `0.x` until the portal is
    complete, not merely deployed.

## Provenance — the rule this portal exists to keep

BetterTago restates a municipality's own published record. **A restatement without a source and a check date
beside it is a rumour with better typography**, so provenance is enforced by schema rather than by review.

- **Cite or don't publish.** Every manifest entry carries `source` (label, URL, document type, retrieval date),
  a `verification` level, and `lastCheckedAt`. `src/lib/content-schema.ts` makes all three non-optional —
  there is no shape of content that renders without them.
- **Every entry also declares a `dataClass` and a `lastReview`.** The class says how fast the page goes out of
  date; **a page with no class fails the build**, because a page with no cadence never goes stale and nobody
  would notice for years. `lastReview` records the ROLE that last re-checked it, or `null`. Cadences and the
  rule against advancing a check date without a check are in [`freshness.md`](freshness.md) — one place.
- **Link back, always.** Every transcribed page names and links the official document it came from. A reader who
  wants the original is one tap away, and the citation names it.
- **The official municipal site is the source of truth.** Where it and this portal disagree, it is right and we
  are wrong, and the correction is a same-day content change.
- **Verification levels are defined in one place — [`governance.md`](governance.md).** `V3` down to `V0`, a
  worked example of each, which level is good enough for what, and the 90-day `V0` re-check. Do not restate
  them here or in any other file: a definition that exists twice is a definition that will disagree with itself,
  and the copy somebody reads will be the stale one.
- **The collector never verifies their own work**, and `verificationRecordSchema` in `content-schema.ts`
  enforces it — a record whose `collectedBy` equals its `verifiedBy` does not parse. The identifiers are
  self-chosen handles whose format cannot express a personal name or an email address, because contributing
  here requires no personal information.
- **`lastCheckedAt` is the date a human last looked**, not the date the page was written.
- **Never round, simplify, or modernise a figure** transcribed from an official document. Where the source is
  unclear, say so on the page and link it — do not resolve the ambiguity by guessing.
- **Never fill a gap with another LGU's answer.** Fees and requirements differ between municipalities. A guide
  that is right somewhere else and wrong here is the most dangerous failure mode this project has: it looks
  complete and it is false.

## The gap register — a labelled gap is honest, a silent omission is not

Most municipal facts about Tago are not published anywhere this project can cite. That is the normal state, not
a bug, and the code encodes it:

- Every unobtained fact in `config/lgu.config.json` is **`null`**, and every null **must** have a matching entry
  in `pending` saying what is missing and how it gets closed. `src/lib/lgu-config.ts` fails the parse otherwise.
- **The reverse also fails**: a `pending` entry pointing at a field that now has a value is stale, and a register
  full of closed items stops being read — at which point the open ones stop being seen.
- **An entry is a record, not a sentence.** Each one carries four fields, and the parse rejects it otherwise:

  | Field           | What it is                                                                                         |
  | --------------- | -------------------------------------------------------------------------------------------------- |
  | `note`          | What is missing and how it gets closed, in at least 40 characters — so `"TODO"` cannot close a gap |
  | `channel`       | How it actually closes: `official-site`, `national-agency`, `field-verification`, or `project`     |
  | `state`         | `open` (not obtained) or `held` (obtained, and deliberately not published)                         |
  | `lastCheckedAt` | **The day somebody looked. Not the day the entry was written**                                     |

  `lastCheckedAt` is the field this shape exists for. Every date in this register was once inherited from a
  document rather than made by a person, and the old shape — a bare string — had nowhere to put one, so nothing
  could tell the difference. **Stamping it without checking is worse than leaving the register alone**: it turns
  "nobody has looked" into "somebody looked and it is still missing", which is a different and false claim.

- **A FILLED fact owes a citation, exactly as a null owes a gap entry.** `lgu.sources` is the mirror of
  `pending`: each tracked figure is either `null` with a `pending` entry, or has a value with a `lgu.sources`
  entry naming where it came from and when somebody looked. Neither, or both, fails the parse. The mirror was
  missing until 2026-08-09, and `lgu.history` had spent two waves carrying six municipal facts with no source
  at all — nothing rendered them, so nothing caught it.
- **`written-request` is not a channel.** The correspondence lane is retired — no request is being sent to any
  office — so an entry claiming a letter will close it would be false the day it was written. The enum rejects
  it, and re-opening that lane is a deliberate decision rather than a word somebody types.
- **An empty list is a gap too.** `emergency.municipalHotlines` is an array, and the null scan does not descend
  arrays, so the largest absence in the record was invisible to the register. An empty hotline list now requires
  its own entry, and a hotline arriving makes that entry stale.
- **`portal.independent` is a literal, not a boolean.** There is no configuration of this portal that lets it
  stop saying it is independent of the Municipal Government of Tago.
- **No emergency number ships without a source.** While `emergency.status` is `not-obtained`, the emergency
  surface renders the gap. A wrong number in an emergency is worse than no number at all.
- **A gap is stated, never blamed.** An outstanding or unobtainable fact is never described as a refusal, a
  concealment, or a lack of transparency — in the register, in a message string, or on a page. _"Not published
  anywhere we can cite"_ is a fact; an inference about intent is not. `guardrails.test.ts` scans all three for
  those framings and fails the build; the rule and its reasoning are in [`governance.md`](governance.md).

## Occam's Razor

Prefer the simplest implementation that fully satisfies the requirement. When more than one approach works,
pick the one with the **fewest moving parts** — least new code, fewest new abstractions, files, or
dependencies, smallest deviation from existing patterns. Here that usually means a content change beats a code
change; a Server Component beats a Client Component; a Kapwa component beats a bespoke one; a CSS solution
beats a JS one. Avoid speculative generality.

The same razor applies to **diagnosis**: favour the explanation that makes the fewest assumptions, then
**verify before acting**. It never overrides the accessibility, security, or data-accuracy rules.
