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

## Data and attribution

Experiment data comes from NASA's [Physical Sciences Informatics](https://psi.nasa.gov/) repository. This is not an official NASA product.
