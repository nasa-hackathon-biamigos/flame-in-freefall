# Space Firefighters

**What microgravity fire taught us — for the Moon and for Earth.**

NASA Space Apps Challenge 2026 — *Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data*.

A curated, comparable catalog of NASA Physical Sciences Informatics (PSI) combustion experiments, read through a fire-safety lens, with an assistant that answers **citing the experiments** and an explicit space → Earth bridge.

- Product spec (source of truth): [docs/SPEC.md](docs/SPEC.md)
- Plan and content: [docs/PLANO.md](docs/PLANO.md) · Team split: [docs/DIVISAO-EQUIPE.md](docs/DIVISAO-EQUIPE.md)

## Stack

Next.js (App Router) + TypeScript · Tailwind + shadcn/ui · next-intl (EN / PT-BR) · Supabase (Postgres + pgvector) · Claude API (answers with citations) · OpenAI embeddings · Vercel.

## Run locally

Requirements: **Node 20+** (recomendado: 24). Gerenciador de pacotes: **pnpm** ou **npm** (o repo tem os dois lockfiles).

### Primeira vez (clone)

```bash
# pnpm
pnpm install

# ou npm
npm install

cp .env.example .env.local   # preencha as chaves (o app sobe sem elas para navegar o catálogo)
npm run data:build           # gera src/generated/catalog.json (obrigatório antes do typecheck)
```

### Subir em desenvolvimento

```bash
pnpm dev    # ou: npm run dev
```

Abre em **http://localhost:3000**. Os scripts `dev` e `build` rodam `data:build` automaticamente (`predev` / `prebuild`).

### Produção local (opcional)

```bash
npm run build && npm run start
```

Se `EADDRINUSE` na porta 3000, pare o outro processo ou use `PORT=3001 npm run start` (PowerShell: `$env:PORT=3001; npm run start`).

Checks: `lint`, `typecheck`, `test`, `build` (com `pnpm` ou `npm run`). Health: `GET /api/health`.

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

### Problemas comuns

| Sintoma | O que fazer |
|---|---|
| `Unknown command: "data:build'` | Atualize o `package.json` do repo (`git pull`) — scripts antigos usavam `npm data:build` em vez de `npm run data:build`. |
| `ENOENT` em `data/vocab.yaml` | A pasta `data/` não está no disco. Rode `git restore data/` (ou `git checkout -- data/`). |
| `data:build` reclama de `true\r` | Checkout no Windows com CRLF — já normalizado no build; puxe a última versão de `src/lib/catalog/build.ts`. |
| `EADDRINUSE` na porta 3000 | Feche outro `next dev` / `next start` ou use outra porta (ver acima). |
| `production build` ao rodar `start` | Rode `npm run build` antes de `npm run start`; para o dia a dia use `npm run dev`. |

### How PSI is scraped

PSI's site is an Angular SPA, but it is backed by an open JSON API (no auth; no `robots.txt`):

- search: `https://psi.nasa.gov/geode-py/ws/repo/search?type=investigation&size=500&ffield=Research%20Area&fvalue=combustion%20science` (also `term=combustion`)
- detail: `https://psi.nasa.gov/geode-py/ws/repo/investigations/<PSI-ID>` — objectives, hypothesis, approach, research impacts, hardware, publications, DOI, license (CC0-1.0)
- experimental tables: `https://psi.nasa.gov/geode-py/ws/studies/<PSI-ID>/download?file=<name>&version=<n>&redirect=false` returns a presigned S3 URL to the CSV

The scraper makes at most 1 request/second. If PSI ever becomes unreachable, a raw file can be written by hand in the same shape (see `PsiRawSchema` in `src/lib/catalog/psi.ts`).

## Ask PSI (RAG chat)

Answers come only from passages of the catalog: the original PSI text of every downloaded investigation, plus curated ficha sections once published. Claude (`ANTHROPIC_MODEL`, default `claude-opus-5-5`) cites each passage natively; embeddings use OpenAI `text-embedding-3-small`.

| Command | What it does |
|---|---|
| `pnpm rag:ingest` | Rebuilds the vector index in Supabase from `data/`. Only new or changed passages are embedded (a few cents at most); `--dry-run` shows what would change. Run it after merging curated fichas. |
| `pnpm rag:warm` | Pre-warms cached answers for `data/demo_questions.yaml` against a running server (`--base <url>`, `--locale en,pt-BR`). **Each uncached question is a paid Claude call.** |

Needs `ANTHROPIC_API_KEY` (an Anthropic key, `sk-ant-...`), `OPENAI_API_KEY`, and the Supabase keys. Limits: `RATE_LIMIT_PER_HOUR`, `DAILY_MESSAGE_CAP`, `RAG_MIN_SIMILARITY` (see `.env.example`).

## Data and attribution

Experiment data comes from NASA's [Physical Sciences Informatics](https://psi.nasa.gov/) repository. This is not an official NASA product.
