# doubleco

Web app scaffold built on Vite + React + TypeScript, with TanStack Router/Query,
Zustand, Zod, Tailwind CSS, Supabase, Biome, deployed on Vercel.

This README is the project's engineering constitution — read it before adding a
feature. It exists so a junior dev and a senior dev make the same structural
decisions without having to ask.

## Tech stack

| Concern              | Choice                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------- |
| Build tool           | Vite                                                                                    |
| UI                   | React 19 + TypeScript                                                                   |
| Routing              | TanStack Router (file-based, client-rendered — see [SSR/SEO](#architecture-decisions))  |
| Server state         | TanStack Query (React Query)                                                            |
| Client/UI state      | Zustand                                                                                 |
| Schema & validation  | Zod                                                                                     |
| Styling              | Tailwind CSS v4                                                                         |
| Component library    | shadcn/ui (Radix primitives, copied into `shared/components/ui`, not an npm dependency) |
| Forms                | React Hook Form + `@hookform/resolvers/zod`                                             |
| Toasts               | sonner                                                                                  |
| Dates                | date-fns                                                                                |
| Icons                | lucide-react                                                                            |
| Backend              | Supabase (Postgres, Auth, Storage)                                                      |
| BFF                  | Supabase Edge Functions — see [Thin client / BFF](#thin-client--bff--server-driven-ui)  |
| Lint & format        | Biome                                                                                   |
| Unit/component tests | Vitest + React Testing Library                                                          |
| E2E tests            | Playwright                                                                              |
| Git hooks            | Husky + lint-staged + commitlint                                                        |
| CI                   | GitHub Actions                                                                          |
| Package manager      | npm                                                                                     |
| Hosting              | Vercel                                                                                  |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in real Supabase values
npm run dev
```

## Scripts

| Script                | What it does                               |
| --------------------- | ------------------------------------------ |
| `npm run dev`         | Start the Vite dev server                  |
| `npm run build`       | Typecheck (`tsc -b`) then production build |
| `npm run preview`     | Preview the production build locally       |
| `npm run typecheck`   | Typecheck only, no build                   |
| `npm run lint`        | Biome lint                                 |
| `npm run format`      | Biome format (writes)                      |
| `npm run check`       | Biome lint + format + import sort (writes) |
| `npm test`            | Run the unit test suite once               |
| `npm run test:watch`  | Run unit tests in watch mode               |
| `npm run test:e2e`    | Run Playwright E2E tests headless          |
| `npm run test:e2e:ui` | Run Playwright E2E tests in UI mode        |

## Folder structure (Feature-Based Architecture)

```
src/
  app/                    # app shell: router wiring only, no business logic
    router.ts             # createRouter() instance
    routeTree.gen.ts       # AUTO-GENERATED — never edit, never commit
    routes/                # TanStack Router file-based routes
      __root.tsx            # root layout: providers, error/not-found boundaries
      index.tsx              # a page

  features/                # one folder per business feature. Self-contained.
    <feature>/
      api/                   # TanStack Query hooks calling a BFF Edge Function + its Zod contract
      components/            # feature-only UI — dumb, renders what the BFF sent, no business logic
      store.ts                 # Zustand store — UI state ONLY for this feature
      types.ts

  shared/                  # reused across 2+ features. Nothing feature-specific here.
    components/
      ui/                     # shadcn/ui primitives (button, input, card, form, ...)
      ErrorBoundary.tsx
    hooks/
    lib/                      # supabase client, query client, result.ts, http.ts, cn()
    stores/                    # global UI-only Zustand stores (theme, sidebar, …)
    config/                     # env.ts (Zod-validated environment)
    types/                       # errors.ts, supabase.ts (generated DB types go here)

  styles/
    index.css               # Tailwind entry + design tokens, incl. shadcn's semantic tokens

  test/
    setup.ts                # Vitest + jest-dom setup

e2e/                       # Playwright E2E specs — separate from src/**/*.test.ts (unit)
supabase/
  functions/
    <function-name>/        # one Deno Edge Function per BFF endpoint — see below
      index.ts
components.json            # shadcn/ui config (paths, style, icon library)
playwright.config.ts
.github/workflows/ci.yml   # lint + typecheck + unit test + build on every PR to main
```

**Rule of thumb:** if code is only used by one feature, it lives inside that
feature's folder. The moment a second feature needs it, promote it to `shared/`.
This is Separation of Concerns applied at the folder level, and it's what keeps
features deletable/replaceable without archaeology.

**Routing note:** in `vite.config.ts`, the `tanstackRouter()` plugin must be
listed before `react()` — it generates `routeTree.gen.ts`, which the rest of
the build then needs to exist. This can't be renamed into obviousness, which
is why it's documented here instead of as a code comment.

**Testing note:** `playwright.config.ts` reuses the Chromium pre-installed at
`/opt/pw-browsers` when that path exists (Claude's cloud sandbox); anywhere
else (local dev, CI) it falls back to Playwright's own browser install.

## Engineering principles, and how this repo enforces them

### Readability & SOLID/KISS/DRY

- One file, one responsibility: a route file only wires a page together; a
  `store.ts` only holds state; an `api/` file only talks to Supabase/HTTP.
- No cleverness for its own sake. Three similar lines beat a premature
  abstraction — don't build a generic "entity factory" until a third feature
  actually needs it.
- Shared logic goes in `shared/lib`, not copy-pasted across features (DRY) —
  but only once it's proven to be shared, not in anticipation of it.
- **No comments in application/config source** — not `//`, not `/* ... */`,
  not `/** ... */`. Reading the code (names, types, small functions) should
  be enough on its own. If a line needs a comment to make sense, that's a
  signal to rename something or extract a function with a clearer name
  instead of explaining the unclear version.
  - Two narrow exceptions, both because there is no naming substitute:
    `/// <reference types="..." />` directives (required TS syntax, not
    prose) and a plugin/step **ordering** constraint that genuinely can't
    be expressed by naming (e.g. why the router Vite plugin runs before
    `@vitejs/plugin-react` — see the Routing note below). When in doubt,
    write it in this README instead of in the file.
  - `.env.example`, `biome.json`/CI YAML, and `README.md` itself aren't
    "code to read top to bottom" in this sense — those keep normal
    documentation comments.
  - Auto-generated files (`routeTree.gen.ts`) are exempt and never
    hand-edited regardless — they're overwritten on the next build.

### Don't reinvent the wheel

If a well-maintained library solves a feature need better, faster, or more
safely than hand-rolled code, use the library — don't hand-build a dropdown,
a date picker, a toast system, a drag-and-drop list, a rich text editor, a
state machine, etc. from scratch. Before reaching for one:

- Prefer a library that is actively maintained, has real adoption
  (stars/downloads), and composes with this stack (Tailwind-friendly, ships
  its own TypeScript types, tree-shakeable).
- Check it against the principles above before adding it — does it keep
  server/UI state separated, does it stay out of `shared/stores` purity,
  does it avoid a runtime type escape hatch that defeats the Zod/TS layer.
- A library that needs a secret key or server call still goes through the
  server-only env tier and a backend function — never bundled client-side.
- Prefer one well-known library over several overlapping ones for the same
  job (e.g. pick one date library, one form library) — this is also DRY at
  the dependency level.
- Unfamiliar/low-adoption packages (an unverified CLI, a random GitHub
  skill) get vetted — read the source or at least the repo's activity and
  maintainer history — before they're installed or executed, since `npx`/
  `npm install -g` runs arbitrary code on the machine running it.

### Type safety (Keamanan Tipe Data)

- `strict` TypeScript (`noUnusedLocals`, `noUnusedParameters`,
  `noFallthroughCasesInSwitch`, etc. — see `tsconfig.app.json`).
- Every external boundary (Supabase rows, HTTP responses, env vars) is
  parsed through a **Zod schema**; the TypeScript type is _inferred_ from
  the schema (`z.infer<...>`), never hand-written separately, so the type
  and the runtime check can never drift apart.
- Biome's `useImportType` rule enforces `import type` for type-only imports,
  which also keeps bundles smaller.

### Performance & efficiency

- TanStack Query caches server state (`staleTime`, `gcTime` tuned in
  `shared/lib/query-client.ts`) — no redundant refetching, no manual
  `useEffect` + `fetch` + loading-state juggling.
- Routes are code-split automatically (`autoCodeSplitting: true` in the
  router Vite plugin) — a page's code loads only when that route is visited.
- Zustand subscriptions are selector-based (`useStore((s) => s.field)`), so a
  component only re-renders when the slice it reads changes.

### Error handling (Penanganan Eror)

- `shared/types/errors.ts` defines a discriminated `AppError` type
  (`network | validation | not_found | unauthorized | unknown`). Boundary
  code returns this instead of throwing/returning raw `unknown`.
- `shared/lib/result.ts` provides a `Result<T, E>` type (`ok`/`err`) so a
  function's signature tells you it can fail — no hidden `throw` deep in a
  call stack.
- `shared/components/ErrorBoundary.tsx` + the root route's `errorComponent`/
  `notFoundComponent` catch render-time and routing errors so one broken
  component never blanks the whole app.

### Testability

- Zustand stores are plain functions with no DOM/network dependency — unit
  test them directly (`features/counter/store.test.ts`).
- Components are tested with React Testing Library against behavior, not
  implementation (`features/counter/components/Counter.test.tsx`).
- `shared/lib/http.ts`'s contract validation is tested by stubbing
  `fetch` (`shared/lib/http.test.ts`) — no real network needed.
- Critical user flows (login, checkout, anything that touches money or
  auth) get a Playwright E2E spec in `e2e/` in addition to unit tests —
  unit tests prove a function/component works in isolation, E2E proves the
  flow works end-to-end against a real running app.

### Component library (shadcn/ui)

Components under `shared/components/ui/` are copied source, not an npm
dependency — that's how shadcn/ui works: you own the code and can edit it
freely. Rules:

- Never hand-edit the visual primitives to chase a one-off design — change
  the token in `src/styles/index.css` instead (keeps Single Source of Truth
  for visual design intact).
- A feature-specific composition (e.g. a `ProductCard`) goes in that
  feature's `components/`, built out of `shared/components/ui/*` — it does
  not itself go in `shared/components/ui/`.
- `components.json` keeps the shadcn CLI's path config in case `npx shadcn
  add <component>` is used later (needs `ui.shadcn.com` allowed in this
  environment's network settings — see the project's setup notes).

### Thin client / BFF / server-driven UI

Decided shape for how the frontend talks to the backend — this is not a
per-feature choice:

- **`src/` never calls `supabase.from(...)`.** Every read/write a feature
  needs goes through a **Supabase Edge Function** (`supabase/functions/`) —
  that's this project's BFF (Backend-for-Frontend). The browser's Supabase
  client (`shared/lib/supabase.ts`) exists for **Auth only**
  (`signInWithPassword`, `signOut`, `getSession`, `onAuthStateChange`) and
  for invoking Edge Functions — never for querying a table directly.
- **The BFF shapes the response for the screen that asked for it.** An
  Edge Function returns exactly the fields/shape that view needs — joined,
  filtered, computed — not a raw table row the frontend then has to
  massage. See `supabase/functions/get-profile/index.ts` +
  `features/profile/api/queries.ts` + `shared/lib/bff.ts`
  (`invokeEdgeFunction`, the `supabase.functions.invoke` equivalent of
  `shared/lib/http.ts`'s `fetchJson`) for the reference pattern.
- **Components stay dumb.** A component renders what its query returned —
  no business logic, no computing a derived value the BFF could have sent
  instead, no reshaping. If a component needs to compute something from
  raw data, that computation belongs in the Edge Function, not the
  component. This is what makes the frontend "thin": it displays state, it
  doesn't decide it.
- **Privileged operations** (anything that needs to bypass RLS, e.g. an
  admin action) use `SUPABASE_SECRET_KEY` from `Deno.env` inside the Edge
  Function — never forwarded to or used from the browser. A normal
  user-scoped read forwards the caller's JWT instead (see the reference
  function) so Postgres RLS still applies — the BFF pattern replaces
  _where business logic lives_, it doesn't replace RLS as a safety net.
- Realtime subscriptions are the one case `supabase-js` in the browser may
  talk to Postgres directly (Realtime needs a live client connection) —
  confirm per-feature when the PRD actually needs it; default to the BFF.

### State separation (API data vs. UI state)

This is the most important rule in the stack:

- **Server state** (anything that ultimately comes from the BFF) —
  **always** TanStack Query, inside a feature's `api/` folder, calling
  `invokeEdgeFunction`. Never copy a query result into a Zustand store "to
  make it easier to access."
- **Client/UI state** (a toggle, a selected tab, form-in-progress values,
  "is this modal open") — Zustand, and _only_ Zustand.
- **Purity of Store**: a Zustand store must contain only synchronous state
  and the setters that mutate it. No `fetch`, no `supabase.from(...)`, no
  `async` query logic inside a store — see `features/counter/store.ts` and
  `shared/stores/ui-store.ts` for the pattern.

### API Contract Validation

Every BFF response is validated against a Zod schema before the app trusts
its shape — see `features/profile/api/schema.ts` +
`features/profile/api/queries.ts` (reference pattern), `shared/lib/bff.ts`
(`invokeEdgeFunction`) and `shared/lib/http.ts` (`fetchJson`, for any
non-Supabase HTTP call). TypeScript types alone only check what _you_
wrote; they say nothing about what the server actually returned at
runtime — that includes the Edge Function's own response, not just
third-party APIs.

### Single Source of Truth for visual design

Every color, font, radius and spacing value lives as a token in
`src/styles/index.css`'s `@theme` block (Tailwind v4's CSS-first config).
**Never hardcode a hex color or an arbitrary pixel value in a component** —
add or reuse a token instead. Rebranding or dark-mode tweaks become a
one-file change.

### Path aliasing

Import from `@/...` instead of `../../../shared/lib/supabase`. Configured in
`tsconfig.app.json` (`paths`) and `vite.config.ts` (`resolve.alias`) — keep
both in sync if you ever change the alias.

### Linter & formatter

Biome (`biome.json`) replaces ESLint + Prettier with one faster tool:
lint, format, and import sorting in a single `npm run check`.

### Git pre-commit hook

Husky + lint-staged (`.husky/pre-commit`) run `biome check --write` on
staged files before every commit — a badly formatted or lint-failing file
never reaches the repo.

### CI pipeline

`.github/workflows/ci.yml` runs on every PR into `main` (and on push to
`main`): `biome ci` (lint + format check, no writes), typecheck, unit
tests, then a production build — all before Vercel's own preview/production
deploy, which stays a separate, parallel check. A red CI run blocks merge
regardless of what Vercel's preview says. E2E tests aren't in CI yet (kept
local/manual via `npm run test:e2e` for now) — add a Playwright job when
the team wants that gate too.

### Semantic commit messages

Enforced by commitlint (`.husky/commit-msg`, `commitlint.config.js`) using
[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <description>

feat(auth):     a new feature
fix(cart):      a bug fix
docs:           documentation only
style:          formatting, no code meaning change
refactor(api):  code change that neither fixes a bug nor adds a feature
perf:           a performance improvement
test:           adding/fixing tests
chore:          tooling, deps, config
ci:             CI/CD pipeline changes
build:          build system / external dependencies
```

### Git branching strategy

Trunk-based: `main` is always deployable, protected, and every push to it
triggers a Vercel production deploy. Every other branch is short-lived and
must start with one of these prefixes:

| Prefix      | Use it for                                                   |
| ----------- | ------------------------------------------------------------ |
| `feature/`  | New functionality (e.g. `feature/login-page`)                |
| `bugfix/`   | Fixing a bug found during testing (not yet in production)    |
| `hotfix/`   | Urgent/critical fix applied directly against production      |
| `refactor/` | Restructuring/cleaning up code with no behavior change       |
| `docs/`     | Documentation only (README, ADRs, comments)                  |
| `chore/`    | Routine maintenance — dependency bumps, build/config changes |

Branch from `main`, open a PR back into `main`, get it reviewed, squash-merge.
Vercel's PR preview deploys give every PR a live URL for review before merge.
A `hotfix/*` still goes through a PR — "critical" means it skips the queue,
not that it skips review.

No long-lived `develop` branch — it rots and causes merge pain in a
small-to-mid team. If the team later needs a staging gate, add a
`release/*` branch convention then, not preemptively.

## Architecture decisions

Decided, not up for re-litigating per-feature — change them here first if a
PRD genuinely requires it, don't quietly drift away from them in one feature.

- **No SSR.** This is an internal dashboard, not a public/SEO-facing site,
  so the plain Vite SPA (client-rendered) in this scaffold stays as-is. If
  a future product need ever requires public, crawlable pages, that's a
  separate decision (e.g. TanStack Start) — don't bolt SSR onto this app;
  stand up a new one for that surface.
- **One environment.** Just local dev + Vercel production (Vercel's PR
  preview deploys already give every PR a disposable pre-prod URL, which
  covers what a long-lived "staging" would otherwise be for). One Supabase
  project, no branching. Re-visit only if the team actually hits a wall
  this doesn't cover — don't pre-build a 3-environment pipeline nobody asked
  for.

## Database conventions

Applies to every table from the first migration — fix the name now, not
after rows (and foreign keys pointing at it) exist.

- **Table names**: plural, `snake_case` — e.g. `products`, `order_items`.
- **Column names**: `snake_case`, fully lowercase — e.g. `created_at`,
  `product_id`, never `createdAt`/`ProductID`.
- **Primary key**: always `id`, type `uuid`, `default gen_random_uuid()`
  (Postgres built-in — no extension needed on Supabase).
- **Foreign key**: `<singular_table_name>_id` — a column referencing
  `products` is named `product_id`, one referencing `order_items` is
  `order_item_id`.
- `created_at timestamptz not null default now()` (and `updated_at` when a
  row is ever edited, not just inserted) is the de-facto standard pairing
  with the above — confirm per-table in the PRD/schema design, not assumed
  here as a hard rule like the four above.

## Authentication strategy

Login is **username + password**. Supabase Auth itself only authenticates
by email or phone — there's no native "username" identity — so this app
derives a stable, fake-but-deterministic email from the username instead of
collecting a real one:

1. `profiles.username` (unique, stored lowercase, validate the input as
   e.g. `[a-z0-9_]{3,20}` at the Zod layer — confirm exact rules in the
   PRD) is the single source of truth for the username.
2. On sign-up, normalize the username (trim, lowercase) and call
   `supabase.auth.signUp({ email: `${username}@users.doubleco.internal`,
   password })` — `users.doubleco.internal` never resolves and never
   receives mail, it only exists to satisfy Supabase Auth's email field.
3. A Postgres trigger on `auth.users` (the standard Supabase
   `handle_new_user()` pattern) inserts the matching `profiles` row from
   `raw_user_meta_data`, keeping `auth.users` and `profiles` in sync
   without a second client round-trip.
4. On sign-in, the client derives the same synthetic email from the
   entered username and calls `supabase.auth.signInWithPassword(...)`
   directly — **no lookup table/RPC needed**, since the email is a pure
   function of the username. This also means a wrong username and a wrong
   password fail identically (Supabase's own generic "Invalid login
   credentials"), so a mistyped username never leaks whether it exists.
5. **RLS is mandatory** on every table, `profiles` included, the moment it
   exists — not a later hardening pass. Authorization/roles (admin vs.
   regular user, etc.) aren't decided yet; that waits for the PRD to define
   what roles the product actually needs.

This isn't built yet (no `features/auth` exists) — it's the agreed shape to
build against once the PRD gets there. Auth is the one deliberate exception
to [Thin client / BFF](#thin-client--bff--server-driven-ui): `supabase.auth.*`
is called directly from the client, never proxied through an Edge Function.

## Environment variables

See `.env.example`. Validated at startup via Zod in `shared/config/env.ts` —
a missing/invalid variable throws immediately on boot instead of failing
confusingly deep inside a feature later.

Two tiers, don't mix them up:

- **`VITE_*`** — bundled into the client JS. Only public values go here
  (Supabase URL + publishable key, Cloudinary cloud name).
- **No prefix** — never reaches `import.meta.env`/the browser at all
  (`SUPABASE_SECRET_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_URL`). These
  are for the BFF: a Supabase Edge Function reads them via `Deno.env.get(...)`
  (set with `supabase secrets set` or the project's Supabase dashboard, not
  `.env.local` — Edge Functions don't read this repo's env files at all).
  Don't invent a client-side use for a secret key; add the Edge Function
  that needs it (e.g. a signed Cloudinary upload, an admin-only Supabase
  operation) under `supabase/functions/`.

`shared/lib/cloudinary.ts` only builds public delivery URLs from the cloud
name — it never touches the API secret.

## Deployment

Vercel auto-detects the Vite build. `vercel.json` adds the SPA rewrite
TanStack Router's client-side routing needs so a hard refresh on
`/some/deep/route` doesn't 404.
