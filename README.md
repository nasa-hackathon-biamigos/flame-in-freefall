# Space Firefighters

**What microgravity fire taught us — for the Moon and for Earth.**

NASA Space Apps Challenge 2026 — *Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data*.

A curated, comparable catalog of NASA Physical Sciences Informatics (PSI) combustion experiments, read through a fire-safety lens, with an assistant that answers **citing the experiments** and an explicit space → Earth bridge.

- Product spec (source of truth): [docs/SPEC.md](docs/SPEC.md)
- Plan and content: [docs/PLANO.md](docs/PLANO.md) · Team split: [docs/DIVISAO-EQUIPE.md](docs/DIVISAO-EQUIPE.md)

## Stack

Next.js (App Router) + TypeScript · Tailwind + shadcn/ui · next-intl (EN / PT-BR) · Supabase (Postgres + pgvector) · Claude API (answers with citations) · OpenAI embeddings · Vercel.

## Run locally

Requirements: Node 24, pnpm 12.

```bash
pnpm install
cp .env.example .env.local   # fill in the keys
pnpm dev                     # http://localhost:3000
```

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Health: `GET /api/health`.

## Database

Migrations live in `supabase/migrations/`. Apply to the linked project:

```bash
npx supabase link --project-ref <ref>
npx supabase db push --remote          # needs Postgres ports (5432/6543)
# On networks that block Postgres ports, run the SQL over HTTPS instead:
npx supabase db query --remote -f supabase/migrations/<file>.sql
```

## Data layer

The curated catalog lives in `data/` and is the source of truth (Supabase only holds derived data).

| Command | What it does |
|---|---|
| `pnpm data:scrape` | Downloads every PSI combustion investigation to `data/raw/psi/<PSI-ID>.json` + `_index.json`. Skips files that exist (`--force` to refresh, or pass IDs: `pnpm data:scrape PSI-25`). |
| `pnpm data:scaffold` | Creates draft fichas for the 12 hero investigations from `data/_template.md`, with the PSI identification pre-filled. Pass IDs for others (`PSI-25`, `--slug` to name it). Never overwrites. |
| `pnpm data:build` | Validates `data/**` and writes `src/generated/catalog.json` + `public/downloads/space-firefighters-catalog.{json,csv}`. Errors are in Portuguese for the curators. Runs before `dev`/`build` and in CI; `--production` (or `VERCEL_ENV=production`) drops example fichas. |

Run `pnpm data:build` once after cloning: `typecheck` needs the generated files.

Curation workflow (Portuguese, for the research team): [docs/CURADORIA.md](docs/CURADORIA.md).

### How PSI is scraped

PSI's site is an Angular SPA, but it is backed by an open JSON API (no auth; no `robots.txt`):

- search: `https://psi.nasa.gov/geode-py/ws/repo/search?type=investigation&size=500&ffield=Research%20Area&fvalue=combustion%20science` (also `term=combustion`)
- detail: `https://psi.nasa.gov/geode-py/ws/repo/investigations/<PSI-ID>` — objectives, hypothesis, approach, research impacts, hardware, publications, DOI, license (CC0-1.0)
- experimental tables: `https://psi.nasa.gov/geode-py/ws/studies/<PSI-ID>/download?file=<name>&version=<n>&redirect=false` returns a presigned S3 URL to the CSV

The scraper makes at most 1 request/second. If PSI ever becomes unreachable, a raw file can be written by hand in the same shape (see `PsiRawSchema` in `src/lib/catalog/psi.ts`).

## Data and attribution

Experiment data comes from NASA's [Physical Sciences Informatics](https://psi.nasa.gov/) repository. This is not an official NASA product.
