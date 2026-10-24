# doubleco

Web app scaffold built on Vite + React + TypeScript, with TanStack Router/Query,
Zustand, Zod, Tailwind CSS, Supabase, Biome, deployed on Vercel.

This README is the project's engineering constitution — read it before adding a
feature. It exists so a junior dev and a senior dev make the same structural
decisions without having to ask.

## Tech stack

| Concern             | Choice                                             |
| ------------------- | -------------------------------------------------- |
| Build tool          | Vite                                               |
| UI                  | React 19 + TypeScript                              |
| Routing             | TanStack Router (file-based)                       |
| Server state        | TanStack Query (React Query)                       |
| Client/UI state     | Zustand                                            |
| Schema & validation | Zod                                                |
| Styling             | Tailwind CSS v4                                    |
| Backend             | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Lint & format       | Biome                                              |
| Tests               | Vitest + React Testing Library                     |
| Git hooks           | Husky + lint-staged + commitlint                   |
| Package manager     | pnpm                                               |
| Hosting             | Vercel                                             |

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in real Supabase values
pnpm dev
```

## Scripts

| Script            | What it does                               |
| ----------------- | ------------------------------------------ |
| `pnpm dev`        | Start the Vite dev server                  |
| `pnpm build`      | Typecheck (`tsc -b`) then production build |
| `pnpm preview`    | Preview the production build locally       |
| `pnpm typecheck`  | Typecheck only, no build                   |
| `pnpm lint`       | Biome lint                                 |
| `pnpm format`     | Biome format (writes)                      |
| `pnpm check`      | Biome lint + format + import sort (writes) |
| `pnpm test`       | Run the test suite once                    |
| `pnpm test:watch` | Run tests in watch mode                    |

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
      api/                   # TanStack Query hooks + Zod schemas (server state + contract)
      components/            # feature-only UI
      store.ts                 # Zustand store — UI state ONLY for this feature
      types.ts

  shared/                  # reused across 2+ features. Nothing feature-specific here.
    components/              # shared/dumb UI (e.g. ErrorBoundary, buttons)
    hooks/
    lib/                      # supabase client, query client, result.ts, http.ts
    stores/                    # global UI-only Zustand stores (theme, sidebar, …)
    config/                     # env.ts (Zod-validated environment)
    types/                       # errors.ts, supabase.ts (generated DB types go here)

  styles/
    index.css               # Tailwind entry + @theme design tokens (see below)

  test/
    setup.ts                # Vitest + jest-dom setup
```

**Rule of thumb:** if code is only used by one feature, it lives inside that
feature's folder. The moment a second feature needs it, promote it to `shared/`.
This is Separation of Concerns applied at the folder level, and it's what keeps
features deletable/replaceable without archaeology.

## Engineering principles, and how this repo enforces them

### Readability & SOLID/KISS/DRY

- One file, one responsibility: a route file only wires a page together; a
  `store.ts` only holds state; an `api/` file only talks to Supabase/HTTP.
- No cleverness for its own sake. Three similar lines beat a premature
  abstraction — don't build a generic "entity factory" until a third feature
  actually needs it.
- Shared logic goes in `shared/lib`, not copy-pasted across features (DRY) —
  but only once it's proven to be shared, not in anticipation of it.

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

### State separation (API data vs. UI state)

This is the most important rule in the stack:

- **Server state** (anything that ultimately comes from Supabase/an API) —
  **always** TanStack Query, inside a feature's `api/` folder. Never copy a
  query result into a Zustand store "to make it easier to access."
- **Client/UI state** (a toggle, a selected tab, form-in-progress values,
  "is this modal open") — Zustand, and _only_ Zustand.
- **Purity of Store**: a Zustand store must contain only synchronous state
  and the setters that mutate it. No `fetch`, no `supabase.from(...)`, no
  `async` query logic inside a store — see `features/counter/store.ts` and
  `shared/stores/ui-store.ts` for the pattern.

### API Contract Validation

Every Supabase/HTTP response is validated against a Zod schema before the
app trusts its shape — see `features/profile/api/schema.ts` +
`features/profile/api/queries.ts` (reference pattern) and
`shared/lib/http.ts` (generic `fetchJson` helper). TypeScript types alone
only check what _you_ wrote; they say nothing about what the server
actually returned at runtime.

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
lint, format, and import sorting in a single `pnpm check`.

### Git pre-commit hook

Husky + lint-staged (`.husky/pre-commit`) run `biome check --write` on
staged files before every commit — a badly formatted or lint-failing file
never reaches the repo.

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

Trunk-based, GitHub-flow style:

- `main` — always deployable. Protected. Every push triggers a Vercel
  production deploy.
- `feature/<short-name>` — new functionality, branched from `main`.
- `fix/<short-name>` — bug fixes.
- `chore/<short-name>` — tooling/deps/config changes with no feature impact.
- Open a PR into `main`, get it reviewed, squash-merge. Vercel's PR preview
  deploys give every PR a live URL for review before merge.
- No long-lived `develop` branch — it rots and causes merge pain in a
  small-to-mid team. If the team later needs a staging gate, add a
  `release/*` branch convention then, not preemptively.

## Environment variables

See `.env.example`. Validated at startup via Zod in `shared/config/env.ts` —
a missing/invalid variable throws immediately on boot instead of failing
confusingly deep inside a feature later.

## Deployment

Vercel auto-detects the Vite build. `vercel.json` adds the SPA rewrite
TanStack Router's client-side routing needs so a hard refresh on
`/some/deep/route` doesn't 404.
