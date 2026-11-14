# Space Firefighters — Especificação para desenvolvimento

> **"What microgravity fire taught us — for the Moon and for Earth."**
> Painel web para o desafio **Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data** do NASA Space Apps Challenge 2026.
> Este documento é a fonte de verdade para o Claude Code construir o projeto. Leia inteiro antes de começar.
> Equipe: Beatriz · Pedro Lukas · Anna Luiza · Caio · Juliana. Quem programa com o Claude Code: **Pedro Lukas**. Data: 14/11/2026.
> Documentos irmãos: [PLANO.md](./PLANO.md) (visão e conteúdo) · [DIVISAO-EQUIPE.md](./DIVISAO-EQUIPE.md) (quem faz o quê). Em caso de conflito, **este SPEC prevalece**.

---

## 0. Como usar este documento (instruções para o Claude Code)

1. Construa **por milestones na ordem da seção 15**. Cada milestone termina **rodando, com deploy de preview na Vercel e demonstrável**.
2. Respeite as camadas de prioridade: **P0 → P1 → P2**. Nunca comece P1 com P0 quebrado. O relógio é curto (seção 15): prefira entregar P0 sólido a P1 pela metade.
3. **Dados reais sempre.** Nunca invente PSI-IDs, URLs, porcentagens de O₂, pressões, nomes de hardware ou spin-offs. Se um dado não existir, deixe `null` + comentário `TODO(data)` no arquivo de dados e mostre "não informado" na UI — nunca um valor plausível. O conteúdo científico é escrito pela curadoria (Anna Luiza, Juliana); o Claude Code **não** escreve fichas, só o template e fichas de exemplo marcadas `example: true` (excluídas do build de produção).
4. A IA **nunca** responde sem fonte. Toda afirmação factual do chat tem citação de um trecho curado; sem trecho relevante, a resposta é "não há dado PSI curado sobre isso".
5. Código, nomes, commits (Conventional Commits) e comentários em **inglês**. UI em **EN (padrão) e PT-BR**. Conteúdo curado (fichas) em **inglês**.
6. Antes de escrever qualquer código que chame a Claude API, carregue a skill `claude-api` (TypeScript) e siga-a — não use padrões de memória.
7. Pergunte ao Pedro antes de: trocar uma tecnologia definida aqui, mudar um vocabulário controlado (seção 6.3), mudar o contrato do Scenario (seção 7) ou remover uma funcionalidade.

---

## 1. Contexto do desafio

**Problema:** fogo é um dos maiores riscos em ambientes tripulados (Apollo 1, Apollo 13, Mir 1997, alarmes recentes). Em microgravidade a chama se comporta de outro jeito (sem empuxo, difusão domina, chama esférica azul), então dados de 1g não bastam. A NASA tem décadas de experimentos de combustão no **Physical Sciences Informatics (PSI)**, mas eles são difíceis de encontrar, comparar e interpretar do ponto de vista de **segurança contra incêndio**.

**Pedido do desafio (resumo):**
- Encontrar e organizar investigações PSI relevantes para fire safety em ambientes habitáveis (ISS, base lunar, veículos pressurizados).
- **Comparar** investigações: semelhanças e diferenças (hardware, combustível, O₂, pressão, fluxo, sensores).
- **Interpretar**: o que cada uma significa para prevenção, detecção e supressão.
- Apoiar **modelagem preditiva** e o desenho de controles/equipamentos.
- Mostrar **benefícios na Terra** (detectores, extintores, EPI de bombeiros).
- Fora do escopo do desafio: combustão de **propelentes/foguetes**.

**Datas:** hackathon em andamento. **H0 = sáb 14/11/2026 09:00** · **submissão até dom 15/11/2026 23:59** (≈ 39 h no total).

**Fatos que guiam o design** (valores a confirmar pela curadoria com fonte — ver seção 6.6):
- Traje: ~4,3 psi, ~100% O₂. Habitat lunar planejado: O₂ elevado (~30%+) a pressão reduzida (≤ ~10,2 psi) → **materiais ficam mais inflamáveis do que na Terra**. Por isso BASS, CFI-G e SAFFIRE importam.
- Gravidade parcial (Lua/Marte) **não tem dados PSI atuais**; só limites 0g/1g e roadmap (LUCI, FM2, E-FIELD). A UI diz isso explicitamente.
- Os três pilares da NASA: **prevenção**, **detecção**, **supressão**.

---

## 2. Visão do produto

**Proposta em uma frase:** um catálogo curado e comparável de experimentos PSI de combustão, lido pela lente de fire safety, com um assistente que **responde citando os experimentos** e uma ponte explícita **espaço → Terra**.

**Diferencial frente a "buscar no PSI":** camada de relevância para fire safety · comparação estruturada · interpretação acionável · impacto na Terra como critério de curadoria · IA com citação obrigatória.

**Momentos "uau" (para jurados e vídeo):**
1. **Mapa O₂ × pressão** — todas as investigações plotadas como faixas de atmosfera, com zonas sombreadas "Terra/ISS", "habitat lunar" e "traje". Mostra de relance o que o PSI cobre e onde **faltam dados** para Artemis.
2. **Comparador** — SAME vs SAME-R, BASS vs SAFFIRE, FLEX vs CFI: tabela com o que mudou vs o que ficou fixo + nota da curadoria.
3. **Ask PSI** — pergunta em linguagem natural → resposta com marcadores clicáveis `[1]` que abrem o trecho exato da ficha.
4. **Earth & Spinoffs** — clique em "detector fumaça/poeira" → SAME/SAME-R → link Spinoff NASA.
5. (se passar no portão, seção 7) **Scenario builder** — "32% O₂, 10 psi, tecido, 0g, habitat lunar" → quais experimentos PSI melhor informam esse risco.

---

## 3. Escopo por prioridade

### P0 — demo garantida
- Formato de ficha em Markdown + validação Zod + build do catálogo (`npm run data:build`).
- Scraper PSI que pré-preenche texto bruto (`npm run data:scrape`) — com fallback manual.
- **12 fichas herói completas** (curadoria) + fichas parciais com selo "parcial".
- Páginas: **Home**, **Explore** (cards + filtros), **Detalhe da investigação**, **Comparador** (2–3), **Earth & Spinoffs**, **Ask PSI** (`/ask`), **About/Data**.
- **Mapa O₂ × pressão** (aba do Explore + mini-versão no Comparador).
- RAG: ingestão de chunks com embeddings OpenAI no Supabase pgvector; chat multi-turn com citações inline + cartões de fonte; rate limit por IP; cache das perguntas de demo; log anônimo.
- **Export do dataset** (JSON + CSV) e API pública somente leitura do catálogo.
- i18n EN/PT-BR; tema escuro "cockpit"; responsivo básico; acessível por teclado.
- Testes pragmáticos (seção 12) e deploy na Vercel.

### Portão de decisão (H+20) — Scenario builder
- Contrato definido agora (seção 7). Matcher + Scorer v0 com pesos **placeholder** implementados no M5 se houver tempo antes do portão.
- No portão, o time decide: **P0** (com pesos do Caio) ou **só pitch** (MODELO-PREVISAO.md vira slide, sem tela).

### P1 — diferenciais
- **Mission context** (`/mission-context`): narrativa Apollo 1 / Apollo 13 / Mir / Artemis + trajes vs habitat + **linha do tempo histórica** (Apollo → PSI → Spinoffs → Artemis).
- **Matriz investigação × atributo** (aba do Explore).
- Explainer LLM do Scenario (se o Scenario passar no portão).
- **Demo mode** (roteiro guiado de cliques para o vídeo, respostas pré-aquecidas).
- "Perguntar sobre esta investigação" (link do detalhe → `/ask` com pergunta pré-preenchida).
- GitHub Action que roda `rag:ingest` quando `data/` muda em `main`.

### P2 — extras
- **Grafo** investigação ↔ hardware ↔ pilar.
- Comparador espaço vs Terra para a mesma variável (ex.: tamanho de partícula SAME vs 1g).
- Toggle de tema claro.

### Fora do escopo
- Treinar modelo preditivo de inflamabilidade (PSI é **fonte** para modelagem futura).
- Dados reais de gravidade parcial (apenas roadmap).
- Propelentes/foguetes. Login/contas. Edição de fichas pela UI.

---

## 4. Stack (decidida — não trocar sem consultar)

| Camada | Tecnologia |
|---|---|
| Framework | **Next.js** (versão estável atual, App Router) + **TypeScript strict** + pnpm |
| UI | Tailwind CSS + **shadcn/ui** (Radix) + lucide-react (ícones) |
| i18n | **next-intl** sem prefixo de rota (locale por cookie, `en` padrão, `pt-BR`) |
| Dados curados | Markdown com frontmatter YAML (`gray-matter`) + Markdown no corpo (`remark`) → validado com **Zod** → `src/generated/catalog.json` |
| Visualizações | SVG próprio com `d3-scale`/`d3-shape` (mapa O₂×pressão, timeline); TanStack Table (matriz, P1); grafo P2 com `react-force-graph-2d` |
| LLM | **Claude API** via `@anthropic-ai/sdk`, modelo **`claude-opus-5-5`** (env `ANTHROPIC_MODEL`) |
| Embeddings | **OpenAI `text-embedding-3-small`** (1536 dims) via pacote `openai` — **só** para embeddings |
| Vector DB + persistência | **Supabase** (Postgres + **pgvector**): chunks, rate limit, cache de respostas, logs anônimos |
| Scraper | Node script (`fetch` + `cheerio`; se o PSI for SPA com API JSON, usar a API) |
| Testes | Vitest, Playwright (1 smoke), script de eval do RAG |
| Qualidade | ESLint, Prettier, `tsc --noEmit` |
| Deploy | **Vercel** (produção + previews por branch) · Supabase cloud (plano gratuito) |
| CI | GitHub Actions |

**Princípio:** o catálogo (fichas) vive **no repositório** e é a fonte de verdade. O Supabase guarda **derivados** (chunks/embeddings) e **dados operacionais** (rate limit, cache, logs). Apagar o Supabase e rodar `rag:ingest` recria tudo.

---

## 5. Estrutura do repositório

```
flame-in-freefall/                    # repo (produto: Space Firefighters)
├── src/
│   ├── app/
│   │   ├── layout.tsx                # shell, tema, provider next-intl
│   │   ├── page.tsx                  # Home
│   │   ├── explore/page.tsx          # cards | mapa O₂×P | matriz (P1)
│   │   ├── investigations/[slug]/page.tsx
│   │   ├── compare/page.tsx          # ?ids=a,b,c
│   │   ├── earth/page.tsx
│   │   ├── ask/page.tsx
│   │   ├── scenario/page.tsx         # atrás de feature flag (portão)
│   │   ├── mission-context/page.tsx  # P1
│   │   ├── about/page.tsx
│   │   └── api/
│   │       ├── investigations/route.ts            # GET lista (JSON)
│   │       ├── investigations/[slug]/route.ts     # GET detalhe
│   │       ├── export/route.ts                    # GET ?format=json|csv
│   │       ├── ask/route.ts                       # POST, SSE streaming
│   │       ├── scenario/route.ts                  # POST (portão)
│   │       └── health/route.ts
│   ├── components/
│   │   ├── ui/                       # shadcn
│   │   ├── investigation/            # InvestigationCard, ConditionsTable, PillarBadge, CurationBadge...
│   │   ├── compare/                  # ComparePicker, DiffTable
│   │   ├── ask/                      # ChatThread, CitationMarker, SourceCard, SuggestedQuestions
│   │   ├── earth/                    # SpinoffCard, SectorFilter
│   │   └── viz/                      # AtmosphereMap, HistoryTimeline (P1), AttributeMatrix (P1), InvestigationGraph (P2)
│   ├── lib/
│   │   ├── catalog/                  # load.ts, filters.ts, diff.ts, schema.ts (Zod), vocab.ts
│   │   ├── rag/                      # retrieve.ts, prompt.ts, claude.ts, citations.ts, cache.ts
│   │   ├── scenario/                 # matcher.ts, scorer.ts, types.ts
│   │   ├── supabase/server.ts        # client com service role (somente server)
│   │   ├── rate-limit.ts
│   │   └── units.ts                  # psi↔kPa, formatação
│   ├── i18n/                         # request.ts, messages/en.json, messages/pt-BR.json
│   └── generated/                    # catalog.json (gitignored, gerado no prebuild)
├── data/
│   ├── _template.md                  # template de ficha (copiar para criar nova)
│   ├── investigations/*.md           # uma ficha por investigação (curadoria)
│   ├── spinoffs/*.md                 # cards Earth & Spinoffs (Juliana)
│   ├── comparisons/*.md              # notas curadas de pares em destaque
│   ├── content/mission-context.md    # P1 (Juliana)
│   ├── content/timeline.yaml         # P1 eventos da linha do tempo
│   ├── reference_atmospheres.yaml    # zonas do mapa O₂×P (com fonte)
│   ├── vocab.yaml                    # vocabulários controlados (seção 6.3)
│   ├── prediction_weights.json       # Caio (seção 7)
│   ├── scenarios/expected.yaml       # 10 cenários de teste do Caio
│   ├── demo_questions.yaml           # perguntas de demo + fontes esperadas
│   └── raw/psi/<psi_id>.json         # saída do scraper (commitada; texto pequeno)
├── scripts/
│   ├── data-build.ts                 # md → valida → catalog.json + public/downloads/*
│   ├── scrape-psi.ts
│   ├── rag-ingest.ts
│   ├── rag-eval.ts
│   └── rag-warm.ts
├── supabase/migrations/*.sql
├── public/downloads/                 # gerado: space-firefighters-catalog.{json,csv}
├── tests/                            # vitest
├── e2e/                              # playwright smoke
├── docs/
│   ├── SPEC.md                       # este arquivo
│   ├── PLANO.md · DIVISAO-EQUIPE.md
│   └── MODELO-PREVISAO.md            # Caio (seção 7)
├── .github/workflows/ci.yml
└── README.md
```

Scripts `package.json`: `dev`, `build` (com `prebuild` = `data:build`), `lint`, `typecheck`, `test`, `e2e`, `data:build`, `data:scrape`, `rag:ingest`, `rag:eval`, `rag:warm`.

---

## 6. Dados

### 6.1 O que é uma ficha

Uma **ficha** é o registro de **uma investigação PSI**: um arquivo `data/investigations/<slug>.md`. Cada ficha vira card no Explore, página de detalhe, coluna no Comparador, ponto no mapa O₂×P, entrada do Scenario e chunks citáveis do chat.

Uma ficha tem duas metades:
- **Texto bruto do PSI** — `data/raw/psi/<psi_id>.json`, gerado pelo scraper; **humanos não editam**.
- **Campos curados** — frontmatter YAML (estruturados) + corpo Markdown com seções fixas (texto). Anna Luiza e Juliana editam pelo GitHub web.

`curation_status`:
- `draft` — esqueleto em preenchimento (gerado por `pnpm data:scaffold` ou copiado do template). O `data:build` valida só o formato e a ficha **fica fora** do catálogo. Decidido no M1 para os esqueletos poderem entrar no repo sem quebrar o CI.
- `complete` — todos os campos vitais (6.4) preenchidos e revisados. Entra em tudo.
- `partial` — tem pelo menos identificação + pilar + texto PSI bruto. Aparece no Explore/Detalhe com selo **"curadoria parcial"** e é citável no chat, mas **fica fora** do Scenario, do mapa O₂×P (se não tiver O₂/pressão) e do diff numérico do Comparador (campos vazios aparecem como "não informado").

### 6.2 Formato da ficha (`data/_template.md`)

```markdown
---
slug: same                                  # kebab-case, único, = nome do arquivo
psi_id: null                                # TODO(data) ex.: "PSI-XXX" — obrigatório para complete
experiment_name: Smoke Aerosol Measurement Experiment
acronym: SAME
aliases: [SAME]                             # usado pelo RAG para casar perguntas pelo nome
psi_url: null                               # TODO(data) link direto PSI
curation_status: draft                      # draft | partial | complete
curators: [juliana]
last_reviewed: 2026-11-14

fire_safety_pillar: [detection]             # 1+ de vocab.pillar
environment_tags: [iss]                     # 0+ de vocab.environment
gravity: [0g]                               # 1+ de vocab.gravity
platform: iss                               # vocab.platform
hardware: [msg, same_hardware]              # 0+ de vocab.hardware
material_class: [smoke_aerosol]             # 1+ de vocab.material_class
solid_form: []                              # se material_class inclui solid: vocab.solid_form
fuels: []                                   # texto livre, ex. ["Kapton", "Teflon"]
sample_geometry: null                       # texto livre

atmosphere:
  o2_percent: { min: null, max: null }      # % em volume; null se não informado
  pressure_psi: { min: null, max: null }    # psia
  diluents: []                              # ex. [N2, CO2, He]
  flow_velocity_cm_s: { min: null, max: null }
  flow_notes: null
  evidence: null                            # de onde vieram os números (seção do PSI ou URL)

sensors: []
measured_variables: []
variables_changed: []                       # o que variou no experimento
variables_fixed: []                         # o que foi mantido fixo
lunar_relevance: null                       # 0–3 (manual): quão diretamente informa habitat lunar
prediction_tags: []                         # vocab.prediction_tags (Caio define)
related: []                                 # slugs relacionados (ex. same-r, daft)

earth_applications:                         # null se não houver
  sectors: []                               # vocab.earth_sectors
  spinoff_slugs: []                         # data/spinoffs/*.md
  transfer_type: null                       # direct_spinoff | conceptual | dual_use_hardware

sources:                                    # toda ficha complete tem ≥1 fonte
  - { label: "PSI entry", url: null }
example: false                              # true = ficha de exemplo, excluída de produção
---

## Summary
2–4 frases em inglês: o que o experimento fez.

## Why it matters for crew safety
3–5 bullets: interpretação fire safety (prevenção/detecção/supressão; ISS/Lua).

## Earth impact
2–4 frases: transferência para a Terra (ou "conceptual" explicando a ligação).

## Key results
Bullets com resultados citáveis, cada um com a origem (seção PSI, paper, URL).

## Limitations
O que este experimento NÃO responde (ex.: gravidade parcial, escala).
```

Regras de validação (Zod em `src/lib/catalog/schema.ts`):
- `slug` = nome do arquivo; `psi_id` único quando presente; vocabulários só com valores de `vocab.yaml`.
- `min ≤ max`; O₂ em [0, 100]; pressão em (0, 30].
- `complete` exige: `psi_id`, `psi_url`, 1+ pilar, 1+ material_class, `atmosphere.o2_percent` e `pressure_psi` (pelo menos `min`) **ou** justificativa explícita em `flow_notes`/`Limitations` quando o experimento não tem atmosfera controlada (ex.: detecção), `variables_changed`/`variables_fixed` não vazios, seções `Summary` e `Why it matters for crew safety` não vazias, `prediction_tags` não vazio, 1+ `sources`.
- Seções do corpo identificadas pelos headings exatos acima; heading desconhecido = aviso, não erro.
- `data:build` falha (exit 1) com mensagem legível em PT apontando arquivo + campo — a curadoria vai ler esses erros no CI do PR.

### 6.3 Vocabulários controlados (`data/vocab.yaml`)

| Vocabulário | Valores |
|---|---|
| `pillar` | `prevention`, `detection`, `suppression` |
| `environment` | `iss`, `lunar_habitat`, `pressurized_rover`, `spacecraft_cabin`, `spacesuit` |
| `gravity` | `0g`, `1g`, `partial_future` |
| `platform` | `iss`, `cygnus`, `ground_lab`, `drop_tower`, `parabolic_flight`, `other` |
| `hardware` | `cir`, `mdca`, `msg`, `spice_duct`, `same_hardware`, `cygnus_saffire`, `other` |
| `material_class` | `solid`, `liquid_droplet`, `gaseous`, `smoke_aerosol` |
| `solid_form` | `fabric`, `sheet`, `rod_cylinder`, `foam`, `wire_insulation`, `other` |
| `earth_sectors` | `first_responders`, `mining`, `buildings`, `aviation`, `manufacturing`, `healthcare`, `other` |
| `transfer_type` | `direct_spinoff`, `conceptual`, `dual_use_hardware` |
| `prediction_tags` | definidos pelo Caio até H+8; seed: `high_oxygen`, `low_pressure`, `solid_flammability`, `flame_spread`, `smoke_aerosol`, `detector_calibration`, `droplet_combustion`, `diluent_suppression`, `large_scale_fire`, `extinction_limit` |

Também em `vocab.yaml`: `spinoff_category` = `detection`, `suppression`, `ppe`, `materials` (as categorias da seção 6.5, com rótulos EN/PT).

> Unificação decidida neste SPEC: a DIVISAO usava `solid_fabric | liquid | gas | aerosol` e o PLANO `solid | liquid_droplet | gas | smoke_aerosol`. Adotado `material_class` + `solid_form` (tecido = `solid` + `fabric`). **Caio confirma até H+8.**

Cada valor tem rótulo EN/PT, ícone e (para pilares) cor — definidos em `vocab.yaml` e consumidos pela UI.

### 6.4 Campos vitais e responsáveis

| Campo | Por que é vital | Quem preenche |
|---|---|---|
| `psi_id`, `experiment_name`, `psi_url` | Rastreabilidade, citação | Anna / Juliana |
| `fire_safety_pillar` | Filtros, Scenario, RAG | Anna / Juliana |
| `material_class`, `solid_form`, `fuels` | Inflamabilidade, Scenario | Anna |
| `atmosphere.*` | Mapa O₂×P, cenário lunar | Anna (+ Caio revisa) |
| `gravity`, `flow_*` | 0g vs 1g | Anna / Juliana |
| `hardware`, `platform` | Comparador, narrativa | Anna / Juliana |
| `sensors`, `measured_variables` | Detecção, modelagem | Juliana |
| `variables_changed` / `variables_fixed` | **Comparar** investigações | Anna / Juliana |
| Seção "Why it matters for crew safety" | UI + RAG | Anna / Juliana |
| `earth_applications` + seção "Earth impact" | Valor na Terra | Juliana |
| `prediction_tags`, `lunar_relevance` | Scenario | Caio define, pesquisa preenche |

**Fichas herói (12, P0)** — distribuição da DIVISAO:
- Anna Luiza: BASS, SPICE, SLICE, BRE, CFI-G, SAFFIRE-I, SAFFIRE-II, SAFFIRE-III
- Juliana: SAME, SAME-R, FLEX, CFI

**Stretch (25+):** BASS-II, FLEX-2, DAFT/DAFT-2, demais ACME, PSI-115 (se aplicável) e outras do PSI `combustion` — entram como `partial` primeiro.

### 6.5 Earth & Spinoffs (`data/spinoffs/<slug>.md`)

```markdown
---
slug: smoke-dust-detector
title: Smoke detector that tells smoke from dust
category: detection                 # detection | suppression | ppe | materials
spinoff_url: null                   # TODO(data) ex. https://spinoff.nasa.gov/node/9407 (confirmar)
related_slugs: [same, same-r, daft]
sectors: [mining, manufacturing]
transfer_type: direct_spinoff
sources: [{ label: "NASA Spinoff", url: null }]
---
2–4 frases em inglês.
```

Quatro cards fixos (P0, Juliana): **detector fumaça/poeira**, **cilindros de ar de bombeiros**, **vestuário de bombeiros**, **névoa fina de água (extintor)**. URLs candidatas estão no PLANO §1/§3 e **devem ser conferidas** antes de entrar.

**Bidirecional:** a ficha lista `earth_applications.spinoff_slugs` e o spinoff lista `related_slugs`. O `data:build` avisa se as duas pontas não batem.

### 6.6 Atmosferas de referência (`data/reference_atmospheres.yaml`)

Zonas sombreadas do mapa O₂×P. **Cada zona exige `source_url`**; sem fonte, a zona não é desenhada.

```yaml
- id: earth_sea_level      # ~21% O₂, ~14.7 psi
  label: { en: "Earth / ISS cabin", pt-BR: "Terra / cabine ISS" }
  o2_percent: { min: null, max: null }   # TODO(data) preencher com fonte
  pressure_psi: { min: null, max: null }
  source_url: null
- id: lunar_habitat        # PLANO: ~30%+ O₂, ≤10.2 psi — confirmar fonte NASA
- id: spacesuit            # PLANO: ~100% O₂, ~4.3 psi — confirmar fonte NASA
```
Dono: Anna Luiza (+ Caio revisa). Prazo: H+8.

### 6.7 Notas de comparação (`data/comparisons/<a>--<b>.md`)

Para os **3 pares em destaque**: `same--same-r`, `bass--saffire-i` (ou SAFFIRE agregado; curadoria decide), `flex--cfi`. Frontmatter: `slugs: [a, b]`, `authors`, `sources`. Corpo: "What changed", "What stayed the same", "So what for fire safety". Viram chunks do RAG e aparecem no Comparador quando o par é selecionado (independe da ordem).

### 6.8 Scraper PSI (`npm run data:scrape`)

1. **Primeiro, investigar** (≤ 45 min de timebox): abrir `https://psi.nasa.gov/physci/repo/search?q=combustion`, ver se a página é SPA e se há endpoint JSON por trás (DevTools/network). Registrar o achado no README.
2. Entrada: lista de `psi_url` das fichas + busca `combustion`. Saída por investigação: `data/raw/psi/<psi_id>.json` com `{ psi_id, title, url, fetched_at, sections: { objectives, approach, results_highlights, ... } }` — texto limpo, sem HTML.
3. Educado: 1 requisição/segundo, `User-Agent` genérico do projeto, respeitar `robots.txt`, cache em disco (não rebaixar se já existe; `--force`).
4. Também gera `data/raw/psi/_index.json` (lista de todas as investigações do resultado `combustion` com título/URL) — a curadoria usa para escolher stretch e para descobrir PSI-IDs.
5. **Fallback:** se o PSI não for raspável em 45 min, a curadoria cola o texto relevante em `data/raw/psi/<psi_id>.json` à mão (mesmo formato; o template fica no README).

**Resultado da investigação (M1):** o PSI é uma SPA Angular sobre uma **API JSON aberta** (sem login, sem `robots.txt`). Busca em `/geode-py/ws/repo/search`, detalhe em `/geode-py/ws/repo/investigations/<PSI-ID>` e tabelas experimentais (CSV) via `/geode-py/ws/studies/<PSI-ID>/download`. Endpoints documentados no README. O PSI **não tem** "results highlights". O formato real do arquivo bruto é `PsiRawSchema` em `src/lib/catalog/psi.ts`: `sections: { objectives, hypothesis, approach, research_impacts }` + `metadata` (plataforma, hardware, relacionadas, palavras-chave) + `publications` (com DOI) + `experimental_tables` (CSV) + `doi` e `license` (CC0-1.0). Os chunks `psi_*` do RAG (seção 8.1) seguem essas seções. `pnpm data:scaffold` cria os esqueletos `draft` das fichas herói com a identificação PSI preenchida (nunca sobrescreve).

### 6.9 Build do catálogo (`npm run data:build`)

Lê `data/**`, valida (6.2), resolve relações, junta texto bruto PSI, e escreve:
- `src/generated/catalog.json` — `{ version: <hash do conteúdo>, generated_at, investigations[], spinoffs[], comparisons[], reference_atmospheres[], vocab }`. Mais `src/generated/catalog-meta.json` (versão + contagens), para rotas leves como `/api/health` não carregarem o catálogo inteiro.
- `public/downloads/space-firefighters-catalog.json` e `.csv` (uma linha por investigação; listas unidas por `;`; colunas numéricas separadas `o2_min`, `o2_max`, `pressure_psi_min`...). Inclui cabeçalho de atribuição NASA PSI e licença.
- Em produção exclui `example: true`. Em dev inclui (com selo "EXAMPLE").
- Imprime resumo: N fichas, N complete, N partial, N com Terra, avisos.

---

## 7. Scenario builder — contrato (portão em H+20)

**O que dizemos:** *"Não prevê fogo; prevê quais experimentos PSI melhor informam o risco de um cenário."* O painel **não substitui** CFD nem teste de bancada.

Dono do modelo: **Caio** (`docs/MODELO-PREVISAO.md` + `data/prediction_weights.json` + `data/scenarios/expected.yaml`). O Claude Code implementa conforme esse documento. Até ele existir, usa o v0 placeholder abaixo, **visivelmente marcado** na UI como "pesos provisórios".

### 7.1 Entrada (`POST /api/scenario`)
```ts
type ScenarioInput = {
  o2_percent: number;            // 0–100
  pressure_psi: number;          // >0–30
  gravity: "0g" | "1g" | "partial_future";
  material_class: "solid" | "liquid_droplet" | "gaseous" | "smoke_aerosol";
  solid_form?: SolidForm;
  pillar: "prevention" | "detection" | "suppression";
  environment: "iss" | "lunar_habitat" | "pressurized_rover" | "spacecraft_cabin" | "spacesuit";
};
```

### 7.2 Saída
```ts
type ScenarioResult = {
  weights_version: string;          // de prediction_weights.json
  provisional: boolean;             // true enquanto o Caio não aprovar
  risk_band: "low" | "medium" | "high" | "insufficient_data";
  confidence: number;               // 0–1
  ranked: Array<{
    slug: string; psi_id: string | null; score: number;   // 0–1
    matched_on: string[];           // ex. ["o2_overlap", "material_class", "pillar"]
    rationale_bullets: string[];    // gerados por regra (templates i18n), não por LLM
  }>;
  coverage_gaps: string[];          // ex. "No PSI data for partial gravity"
  explanation?: { text: string; citations: Citation[] };  // P1: Explainer LLM
};
```

### 7.3 Camadas
1. **Matcher** — só fichas `complete`. Filtros duros: `material_class` (com `solid_form` como bônus), `pillar`. Sobreposição de faixa O₂ e pressão com tolerância definida nos pesos.
2. **Scorer** — soma ponderada (`prediction_weights.json`): `o2_overlap`, `pressure_overlap`, `material_match`, `solid_form_match`, `pillar_match`, `gravity_match`, `environment_tag_match`, `lunar_relevance`, `prediction_tags` ativadas por regras (ex.: `o2_percent > limiar_earth` → `high_oxygen`). `risk_band` por regras explícitas do Caio; se nenhuma ficha passa o limiar de evidência → `insufficient_data`. `gravity: partial_future` sempre adiciona um `coverage_gap`.
3. **Explainer (P1)** — Claude recebe o resultado + chunks das fichas ranqueadas e escreve 1 parágrafo citado (mesma mecânica do chat, seção 8). Nunca altera `risk_band` nem o ranking.

O v0 placeholder usa pesos iguais e `risk_band` sempre `insufficient_data` com `provisional: true` — para a UI e os testes funcionarem sem inventar ciência.

### 7.4 Testes
`data/scenarios/expected.yaml` (Caio, 10 cenários: 5 lunares, 3 ISS, 2 Terra): entrada + `expected_top_slugs` (conjunto, ordem não estrita nos 3 primeiros) + `expected_risk_band`. Teste Vitest roda todos; enquanto `provisional`, os testes de `risk_band` ficam `skip` com motivo.

### 7.5 Critério do portão (H+20, dom 05:00 — se o time estiver dormindo, na 1ª sync de domingo, no máximo H+24)
Passa para P0 se: `MODELO-PREVISAO.md` existe, pesos não provisórios, ≥ 12 fichas `complete`, ≥ 7 de 10 cenários passando. Senão: tela escondida (`FEATURE_SCENARIO=false`), conteúdo vira slide.

---

## 8. IA — Ask PSI (RAG com citações)

### 8.1 Ingestão (`npm run rag:ingest`)
- Fonte: `catalog.json` + `data/raw/psi/*.json`.
- **1 chunk = 1 seção semântica**, com prefixo de contexto no texto (ex.: `"SAME (PSI-XXX) — Why it matters for crew safety:\n..."`):
  - `summary`, `crew_safety`, `earth_impact`, `key_results`, `limitations` (seções da ficha)
  - `conditions` — texto **gerado deterministicamente** dos campos estruturados ("O₂ 21–21%, pressure 14.7 psia, hardware MSG...")
  - `psi_objectives`, `psi_hypothesis`, `psi_approach`, `psi_research_impacts` (texto bruto PSI; quebrar em ~400–600 tokens se maior)
  - `comparison` (de `data/comparisons`), `spinoff` (de `data/spinoffs`), `mission_context` (P1, por parágrafo)
- Metadados: `slug`, `psi_id`, `experiment`, `section`, `pillar[]`, `environment[]`, `curation_status`, `has_earth_transfer`, `source_url`, `source_label`.
- Idempotente: `id = sha256(slug + section + idx)`, `content_hash` — só reembeda o que mudou; remove chunks órfãos. Grava `catalog_version`.
- Embeddings em lote (`text-embedding-3-small`).

### 8.2 Recuperação
1. Query de busca = última pergunta do usuário + pergunta anterior (para follow-ups como "e no SAME-R?"). Sem chamada LLM extra.
2. **Aliases:** se a query menciona um `acronym`/`alias` de ficha (case-insensitive, palavra inteira), os chunks `summary`, `crew_safety`, `conditions` dessa ficha entram obrigatoriamente.
3. **Vetorial:** RPC `match_rag_chunks(query_embedding, match_count := 12, min_similarity := env)` no Supabase.
4. Mesclar, deduplicar, limitar a **~12 chunks** (~8–15k tokens), ordenar por ficha.
5. **Sem evidência:** se nenhum chunk passa `min_similarity` e não houve alias → responder sem chamar a Claude com a mensagem fixa i18n "não há dado PSI curado sobre isso" + sugestões de perguntas. O limiar é calibrado pelo `rag:eval`.

### 8.3 Chamada à Claude
- `@anthropic-ai/sdk`, modelo `ANTHROPIC_MODEL` (padrão `claude-opus-5-5`), **streaming**, `thinking: { type: "adaptive" }`, `output_config.effort` = `ANTHROPIC_EFFORT` (padrão `low` para chat; calibrar com o eval), `max_tokens` ~4000.
- **Fallback de recusa** ligado por padrão: `betas: ["server-side-fallback-2026-07-01"]` + `fallbacks: "default"` (chamada pelo namespace beta). Sempre checar `stop_reason` (`refusal` → mensagem amigável).
- **Citações nativas:** cada chunk vai como bloco **`search_result`** no conteúdo da mensagem do usuário, com `source` = URL da ficha no app (`/investigations/<slug>#<section>`), `title` = `"<ACRONYM> · <PSI-ID> · <Section>"`, `content` = texto do chunk, `citations: { enabled: true }`. A resposta volta com `citations` (`cited_text`, índice do resultado). **Conferir a forma exata na skill `claude-api` / docs ao vivo antes de codar.** Citations é incompatível com `output_config.format` — não usar structured outputs nesta rota.
- **System prompt** (versionado em `src/lib/rag/prompt.ts`, `PROMPT_VERSION`), estável para prompt caching:
  - Você é o assistente do Space Firefighters; responde sobre fire safety em **ambientes tripulados habitáveis** com base **exclusivamente** nos resultados de busca fornecidos (fichas curadas do NASA PSI).
  - Toda afirmação factual deve vir de um resultado citado. **Nunca** invente números, IDs ou experimentos. Se os resultados não respondem, diga isso claramente e sugira o que perguntar.
  - Fora do escopo: propelentes, motores de foguete, armas/incêndio intencional → recusar educadamente e redirecionar.
  - Diferencie microgravidade, 1g e "gravidade parcial (sem dados PSI)". Avise quando uma fonte é de ficha `partial`.
  - Responda no idioma da pergunta; seja conciso (≤ ~250 palavras salvo pedido); use bullets para comparações.
- **Prompt caching:** `cache_control` no system prompt; histórico append-only para reaproveitar cache entre turnos.

### 8.4 Multi-turn
- Conversa identificada por `conversation_id` (uuid em `sessionStorage`; recarregar a página = conversa nova).
- O **servidor** guarda as mensagens exatas enviadas/recebidas em `chat_turns` e reconstrói o histórico a partir do Supabase (o cliente envia só `conversation_id` + nova pergunta — evita injeção de "fontes" falsas pelo cliente). Histórico **append-only**: mensagens anteriores são reenviadas sem alteração.
- Máximo **6 perguntas por conversa**; depois a UI oferece "nova conversa".

### 8.5 UI de citações
- Durante o streaming: texto aparece incrementalmente; ao fechar cada bloco citado, inserir marcador **`[n]`** (n = ordem da fonte na resposta).
- Abaixo da resposta: **cartões de fonte** numerados — sigla, PSI-ID, seção, `cited_text` (trecho exato), selo `partial` se aplicável, link "abrir ficha" (âncora na seção) e link PSI externo.
- Hover/foco em `[n]` destaca o cartão; clique rola até ele.
- Perguntas sugeridas (chips) vindas de `data/demo_questions.yaml` (EN/PT).

### 8.6 Custo, cache e abuso
- **Rate limit:** `RATE_LIMIT_PER_HOUR` (padrão 30) mensagens/h por `ip_hash = sha256(ip + IP_HASH_SALT)`; teto global diário `DAILY_MESSAGE_CAP` (padrão 1500). 429 com mensagem amigável; perguntas sugeridas cacheadas continuam funcionando.
- **Cache de respostas:** só para o **primeiro turno**, chave = `sha256(normalize(pergunta) + locale + catalog_version + PROMPT_VERSION + model)`. Hit = replay da resposta guardada (simulando streaming rápido). `npm run rag:warm` pré-aquece todas as `demo_questions`.
- **Logs anônimos** (`chat_turns`): pergunta, fontes citadas (slugs), latência, modelo, tokens de entrada/saída/cache, cache hit, erro. **Sem IP** (o hash fica só em `rate_limits`, apagável).
- Validação de entrada: pergunta 3–1000 caracteres; rejeitar conversas desconhecidas/expiradas (> 24 h).

### 8.7 Perguntas de demo (`data/demo_questions.yaml`)
Do PLANO §8 — cada uma com `expected_slugs` (preenchido pela curadoria):
1. Which PSI experiments test smoke detection in microgravity, and what aerosol sizes did they measure?
2. Compare BASS with SAFFIRE in scale and material type.
3. What does PSI suggest about flammability at oxygen levels close to those planned for a lunar habitat?
4. What FLEX data support suppression by atmospheric dilution?
5. Which solid-fuel experiments used the SPICE duct (MSG hardware)?
6. How do SAME and SAME-R inform Earth smoke detectors with fewer false alarms from dust?
7. Which PSI research linked to FLEX or suppression relates to fine water mist extinguishers?
8. Which NASA spinoffs from spacesuit tech improved firefighter air cylinders or clothing, and is there adjacent PSI data?
+ 2 perguntas **fora do escopo** (ex.: propelente sólido) e 2 **sem dado** (ex.: gravidade marciana) para testar recusa/"não há dado".

---

## 9. API — contrato

Route Handlers do Next.js. Respostas JSON tipadas (tipos em `src/lib/**/types.ts`, schemas Zod para entrada). Erros: `{ error: { code, message_key } }` (chave i18n).

| Método | Rota | Descrição | Prioridade |
|---|---|---|---|
| GET | `/api/health` | `{ ok, catalog_version, supabase: ok/err }` | P0 |
| GET | `/api/investigations?pillar=&env=&gravity=&material=&hardware=&earth=1&status=&q=` | Lista resumida (filtros iguais aos do Explore) | P0 |
| GET | `/api/investigations/[slug]` | Ficha completa (inclui texto PSI bruto) | P0 |
| GET | `/api/export?format=json\|csv` | Dataset curado (redireciona para `/downloads/...`) | P0 |
| POST | `/api/ask` | `{ conversation_id?, question, locale }` → **SSE**: eventos `meta` (conversation_id, cached), `text_delta`, `citation` (n, slug, psi_id, section, cited_text, url), `done` (usage), `error` | P0 |
| POST | `/api/scenario` | Seção 7; 404 se `FEATURE_SCENARIO=false` | Portão |

API pública somente leitura (`/api/investigations*`, `/api/export`) com CORS aberto e cache HTTP (`s-maxage`). `/api/ask` só aceita origem do próprio site.

---

## 10. Frontend

### 10.1 Moldura global
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔥 Space Firefighters   Explore  Compare  Earth  Ask PSI  [Scenario] [Mission]  EN|PT │
├──────────────────────────────────────────────────────────────────────────────┤
│                               (rota atual)                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ Data: NASA Physical Sciences Informatics · Not an official NASA product · About │
└──────────────────────────────────────────────────────────────────────────────┘
```
- **Bandeja de comparação** global: botão "+ Compare" em cards/detalhe adiciona à bandeja (máx. 3, estado na URL/`sessionStorage`); a bandeja flutuante leva a `/compare?ids=`.
- Filtros e seleção relevantes **na URL** (links compartilháveis para o vídeo).

### 10.2 Rotas
| Rota | Tela | Prioridade |
|---|---|---|
| `/` | Home | P0 |
| `/explore` (`?view=cards\|map\|matrix`) | Explore | P0 (matrix P1) |
| `/investigations/[slug]` | Detalhe | P0 |
| `/compare?ids=a,b,c` | Comparador | P0 |
| `/earth` | Earth & Spinoffs | P0 |
| `/ask` (`?q=`) | Ask PSI | P0 |
| `/about` | Fontes, limitações, licença, download, como citar | P0 |
| `/scenario` | Scenario builder | Portão |
| `/mission-context` | Mission context + timeline | P1 |

### 10.3 Home
```
┌ Hero: "Fire behaves differently in space. NASA has the data. We make it usable." ┐
│ [Explore experiments] [Ask PSI]                                                   │
├──────────── 3 pilares (cards clicáveis → Explore filtrado) ──────────────────────┤
│ 🛡 Prevention (n)      📡 Detection (n)      🧯 Suppression (n)                    │
├──────────── KPIs ────────────────────────────────────────────────────────────────┤
│ N investigations · N fully curated · N with Earth applications · N relevant to lunar O₂ │
├──────────── Impacto dual ────────────────────────────────────────────────────────┤
│ 🌙 Artemis/lunar habitat strip  |  🌍 Earth: detector · mist · PPE (→ /earth)       │
├──────────── Comparações em destaque (3 pares) ───────────────────────────────────┤
└──────────── Mini mapa O₂×P (→ /explore?view=map) ────────────────────────────────┘
```

### 10.4 Explore
- **Filtros** (sidebar no desktop, sheet no celular): busca textual (nome/sigla/alias), pilar, ambiente, gravidade, material, hardware, "só com benefício na Terra", status (complete/partial). Contagem por opção.
- **Cards:** sigla grande, nome, PSI-ID, badges de pilar (ícone + cor + texto), hardware, faixa O₂/pressão (ou "não informado"), selo Terra 🌍, selo "parcial", "+ Compare".
- **Aba Mapa O₂×P** (seção 10.8). **Aba Matriz** (P1): linhas = investigações, colunas = atributos, células com ícones; ordenável.
- Estado vazio explicado ("nenhuma investigação com esses filtros — limpar").

### 10.5 Detalhe da investigação
```
┌ SAME · Smoke Aerosol Measurement Experiment · PSI-XXX ↗ · 🛡/📡/🧯 · [partial?] ── [+ Compare] [Ask about this] ┐
├── Summary ──────────────────────────────┬── Conditions (tabela) ──────────────────┤
│                                         │ O₂ · pressure (psi + kPa) · diluents     │
├── Why it matters for crew safety ───────│ flow · gravity · platform · hardware     │
│  bullets                                │ fuels/materials · sensors · measured     │
├── Earth impact (cards spinoff) ─────────┴──────────────────────────────────────────┤
├── Changed vs fixed (duas colunas) ── Key results ── Limitations ───────────────────┤
├── Posição no mapa O₂×P (mini) ── Related investigations ── Sources ─────────────────┤
└── PSI original text (colapsável: objectives / approach / results) ─────────────────┘
```
Cada seção tem âncora (`#crew_safety` etc.) — é o alvo dos links de citação do chat (destacar a seção ao chegar por âncora).

### 10.6 Comparador
- Picker com busca (2–3 investigações; parciais permitidas com aviso).
- **Tabela de diff:** linhas = atributos (pilar, plataforma, hardware, material, O₂, pressão, fluxo, gravidade, sensores, variáveis medidas, Terra); célula igual em todas → estilo "igual" (ícone =); diferente → destaque (ícone ≠). Toggle "mostrar só diferenças".
- **Changed vs fixed** de cada uma, lado a lado.
- **Nota curada** do par (6.7) quando existir, com autor.
- Mini mapa O₂×P só com as selecionadas.
- Botões de pares em destaque no topo.

### 10.7 Earth & Spinoffs
- Contador: "N investigations with documented Earth applications".
- Cards por categoria (Detection · Suppression · PPE · Materials) com setor, tipo de transferência (badge `direct spinoff` / `conceptual` / `dual-use hardware`) e link Spinoff.
- **Mapa bidirecional:** clicar num card destaca as investigações relacionadas (lista/linhas de ligação) e vice-versa; cada investigação leva à ficha.
- Filtro por setor.

### 10.8 Mapa O₂ × pressão (`AtmosphereMap`, P0)
- Eixo X = pressão (psia, rótulo secundário kPa); eixo Y = O₂ (% vol). Escalas lineares, domínio ajustado aos dados e às zonas.
- Cada investigação = **retângulo** (faixa min–max) ou **ponto** (valor único), cor/ícone pelo pilar, rótulo com sigla (anti-colisão simples). Hover = tooltip com valores e evidência; clique = ficha.
- **Zonas de referência** (6.6) sombreadas e rotuladas; só desenhadas se têm fonte.
- Lista lateral "sem dados de atmosfera" com as fichas que não puderam ser plotadas (honestidade sobre lacunas).
- Acessível: tabela equivalente oculta para leitores de tela + navegação por Tab entre os itens.

### 10.9 Ask PSI
- Coluna central de chat; chips de perguntas sugeridas no estado vazio; aviso fixo: "Answers are generated from curated NASA PSI records and may be incomplete. Always check the cited sources."
- Mensagem do assistente: texto com `[n]` + cartões de fonte (8.5). Indicador "respondido do cache" discreto. Botão "nova conversa". Contador "x/6 perguntas".
- Erros: rate limit (com horário de liberação), fora do ar, recusa.

### 10.10 Scenario (portão)
Formulário (sliders O₂ e pressão com valores e zonas de referência mostradas; selects dos enums) → resultado: `risk_band` com ícone + texto (nunca só cor), selo "pesos provisórios" se `provisional`, lista ranqueada com `matched_on` e bullets, `coverage_gaps`, Explainer (P1). Presets: "Lunar habitat", "ISS cabin", "Spacesuit pre-breathe", "Earth building".

### 10.11 Mission context (P1)
Conteúdo de `data/content/mission-context.md` (Juliana) + **linha do tempo** (`timeline.yaml`: data, título, tipo `accident|experiment|spinoff|mission`, link, slugs relacionados) em SVG horizontal rolável. Bloco "Spacesuit vs lunar habitat vs Earth" reaproveitando as zonas do mapa.

### 10.12 Identidade visual — tema escuro "cockpit"
- Tokens em CSS variables (Tailwind lê os tokens): `--bg` ~`#0A0E14`, `--surface`, `--border`, `--text`, `--muted`, `--flame` laranja (~`#FF7A1A`, chama 1g), `--plasma` azul (~`#4DA3FF`, chama esférica em 0g), `--earth` verde-azulado, cores por pilar, `--ok/--warn/--bad`. Contraste AA garantido.
- Tipografia: Inter (texto) + JetBrains Mono (números, IDs) via `next/font`.
- Pilares **sempre** com ícone + texto, nunca só cor.
- Movimento discreto (respeitar `prefers-reduced-motion`).

### 10.13 UX transversal
- **i18n:** toda string de UI em `messages/en.json` e `pt-BR.json`; números/unidades via `Intl`. Conteúdo curado fica em inglês (rótulo "content in English" no modo PT).
- **Responsivo básico:** funciona no celular sem quebrar (filtros em sheet, tabela do comparador com scroll horizontal, mapa com zoom simples); otimizado para desktop 1440 px (vídeo).
- **Acessibilidade:** navegação por teclado, foco visível, `aria-*` nos componentes Radix, alt nos ícones.
- **Estados:** skeletons, erros amigáveis, vazio explicado.
- **Desempenho:** páginas do catálogo estáticas (SSG a partir de `catalog.json`); primeira carga < 2,5 s em 4G.
- **Demo mode (P1):** `?demo=1` mostra um stepper discreto com o roteiro do vídeo (Home → filtro lunar → mapa → BASS×SAFFIRE → Earth → SAME → Ask com pergunta pré-aquecida).

---

## 11. Banco (Supabase)

Migrações SQL em `supabase/migrations/`. **RLS ligado em todas as tabelas, sem policies públicas** — só o servidor acessa, com `SUPABASE_SERVICE_ROLE_KEY` (nunca exposta ao cliente).

```sql
create extension if not exists vector;

create table rag_chunks (
  id text primary key,                 -- sha256(slug+section+idx)
  slug text, psi_id text, section text,
  content text not null,
  metadata jsonb not null,
  embedding vector(1536) not null,
  content_hash text not null,
  catalog_version text not null,
  updated_at timestamptz default now()
);
create index on rag_chunks using hnsw (embedding vector_cosine_ops);
-- função match_rag_chunks(query_embedding vector(1536), match_count int, min_similarity float)

create table chat_conversations (id uuid primary key, locale text, created_at timestamptz default now());
create table chat_turns (
  id bigserial primary key, conversation_id uuid references chat_conversations(id),
  turn_index int, question text,
  request_messages jsonb, response_content jsonb,   -- exatos, para histórico append-only
  cited_slugs text[], model text, prompt_version text, catalog_version text,
  input_tokens int, output_tokens int, cache_read_tokens int,
  latency_ms int, cache_hit boolean, error text, created_at timestamptz default now()
);
create table answer_cache (key text primary key, question text, locale text, response jsonb, created_at timestamptz default now());
create table rate_limits (ip_hash text, window_start timestamptz, count int, primary key (ip_hash, window_start));
```

---

## 12. Testes e validação (pragmático)

- **Dados:** `data:build` no CI de todo PR — falha com mensagem PT legível. Testes Vitest do schema (fichas válidas/inválidas de fixture).
- **Lógica:** Vitest para `filters`, `diff` (comparador), `units`, geração do chunk `conditions`, mapeamento de citações → cartões (com resposta fake da Claude), rate limit.
- **Scenario:** Vitest roda `data/scenarios/expected.yaml` (seção 7.4).
- **RAG eval** (`npm run rag:eval`, manual — **custa dinheiro**, pedir OK ao Pedro antes): roda `demo_questions.yaml` contra o endpoint local; checa (a) ≥ 1 citação nas perguntas normais, (b) `expected_slugs` ⊂ citados, (c) recusa nas fora de escopo, (d) "não há dado" nas sem dado; mede latência e tokens. Gera `reports/rag-eval-<timestamp>.md`. **Meta para o pitch:** 8/8 normais + 4/4 controle.
- **E2E (1 smoke Playwright):** Home → Explore (filtro detecção) → ficha SAME → + Compare SAME-R → Comparador mostra diff → Ask (pergunta pré-aquecida, cache) mostra `[1]` e cartão de fonte.
- Sem metas de cobertura.

---

## 13. Infra, deploy e CI

- **Vercel:** projeto ligado ao GitHub; preview por branch/PR; produção em `main`. Função `/api/ask` com runtime Node e `maxDuration` suficiente para streaming (60 s).
- **Supabase:** projeto cloud; migrações aplicadas via CLI (`supabase db push`) ou SQL editor.
- **Variáveis de ambiente:**

| Var | Uso |
|---|---|
| `ANTHROPIC_API_KEY` | Claude |
| `ANTHROPIC_MODEL` | padrão `claude-opus-5-5` |
| `ANTHROPIC_EFFORT` | padrão `low` |
| `OPENAI_API_KEY` | embeddings |
| `OPENAI_EMBEDDING_MODEL` | padrão `text-embedding-3-small` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | servidor |
| `RAG_MIN_SIMILARITY` | limiar calibrado pelo eval |
| `RATE_LIMIT_PER_HOUR`, `DAILY_MESSAGE_CAP`, `IP_HASH_SALT` | abuso/custo |
| `FEATURE_SCENARIO` | portão (seção 7.5) |
| `NEXT_PUBLIC_SITE_URL` | links absolutos/CORS |

- **CI (GitHub Actions):** `lint`, `typecheck`, `data:build`, `test` em todo PR. (P1) job `rag:ingest` em push para `main` quando `data/**` muda.
- **Teto de gasto** configurado no console Anthropic e na OpenAI.
- `.env.example` documentado; nenhum segredo no repo.

---

## 14. Padrões de código

- TS `strict`, sem `any`; Zod em toda fronteira (arquivos de dados, body de API, respostas de terceiros).
- Unidades no nome (`o2_percent`, `pressure_psi`, `flow_velocity_cm_s`, `latency_ms`).
- Server Components por padrão; `"use client"` só onde há interação. Nenhuma chave de API no cliente.
- Componentes pequenos, hooks por feature, sem lógica de negócio em componentes de página.
- Conventional Commits em inglês: `feat:`, `fix:`, `data:` (fichas), `docs:`, `chore:`, `test:`.
- Fluxo: Pedro trabalha em branches curtas → PR → preview Vercel → merge. Curadoria abre PRs de `data/` pelo GitHub web; Pedro faz o merge (dono do schema).

---

## 15. Milestones (ordem de construção)

Relógio: **H0 = sáb 09:00**. Horários são alvos; se um milestone atrasar, cortar escopo do próximo, não do P0.

| # | Alvo | Milestone | Critério de aceite |
|---|---|---|---|
| M0 | H+4 (sáb 13h) | Scaffold | Next + Tailwind + shadcn + next-intl + tema; CI verde; deploy Vercel com "hello"; Supabase criado e migrações aplicadas; `.env.example`; README |
| M1 | H+7 (sáb 16h) | Camada de dados | `vocab.yaml`, `_template.md`, schema Zod, `data:build` (JSON+CSV), 2 fichas `example`, investigação + script do scraper rodando (ou fallback documentado), `_index.json` entregue à curadoria |
| M2 | H+12 (sáb 21h) | Catálogo P0 | Home, Explore (cards + filtros), Detalhe, About, export, API de leitura — com as fichas reais que já existirem |
| M3 | H+18 (dom 03h) | Ask PSI P0 | `rag:ingest`, retrieval, `/api/ask` SSE com citações, UI com `[n]` + cartões, multi-turn, rate limit, logs, cache + `rag:warm` |
| — | H+20 (dom 05h, máx. H+24) | **Portão do Scenario** | Decisão registrada no README |
| M4 | H+26 (dom 11h) | Comparar + Terra + Mapa | Comparador (diff + notas + mini mapa), Earth & Spinoffs, Mapa O₂×P no Explore e Home |
| M5 | H+31 (dom 16h) | Scenario (se passou) | `/api/scenario` + tela + testes dos 10 cenários; senão, P1 abaixo |
| M6 | H+35 (dom 20h) | P1 + polimento | Mission context + timeline, demo mode, matriz, ajustes da Beatriz, `rag:eval` final, smoke E2E verde |
| M7 | H+36 (dom 21h) | **Code freeze** | Só correções de bug e conteúdo. Vídeo, slides e submissão até 23:59 |

Após cada milestone: atualizar `README.md` (como rodar), marcar o checklist abaixo e avisar no grupo o link do preview.

---

## 16. Entregas humanas (contrato com o Claude Code)

O que o código **espera** receber de cada pessoa. Sem isso, o código usa placeholder visível — nunca dado inventado.

| Quem | Entrega | Onde | Até |
|---|---|---|---|
| Anna Luiza | Fichas BASS, SPICE, SLICE, BRE (complete) | `data/investigations/` | H+10 |
| Anna Luiza | CFI-G, SAFFIRE I–III (complete) + `reference_atmospheres.yaml` com fontes | `data/` | H+16 |
| Anna Luiza | Nota de comparação BASS × SAFFIRE | `data/comparisons/` | H+20 |
| Juliana | SAME, SAME-R, FLEX, CFI (complete) | `data/investigations/` | H+10 |
| Juliana | 4 spinoffs com URLs conferidas + notas SAME×SAME-R e FLEX×CFI | `data/spinoffs/`, `data/comparisons/` | H+18 |
| Juliana | Mission context + `timeline.yaml` (P1) | `data/content/` | H+28 |
| Caio | Confirmar vocabulários (`material_class`, `prediction_tags`) | `data/vocab.yaml` (PR) | H+8 |
| Caio | `MODELO-PREVISAO.md`, `prediction_weights.json`, `scenarios/expected.yaml` | `docs/`, `data/` | H+20 |
| Anna + Juliana | `expected_slugs` das perguntas de demo | `data/demo_questions.yaml` | H+20 |
| Beatriz | Revisão visual de cada preview + lista de ajustes (issue no GitHub) | Issues | após M2, M3, M4 |
| Beatriz | Roteiro de cliques do vídeo (alimenta o demo mode) | `docs/DEMO-SCRIPT.md` | H+30 |

**"Ficha pronta" (checklist do PR):** `data:build` verde · `curation_status: complete` · PSI-ID e URL conferidos · números com `evidence` · "Why it matters" com 3–5 bullets · Terra preenchida ou `null` justificado · revisada por outra curadora.

---

## 17. Checklist de aceite da demo (P0)

- [ ] Abrir a URL de produção e ver a Home com KPIs reais.
- [ ] Explore: filtrar "Detection" e "só com benefício na Terra" → SAME/SAME-R aparecem.
- [ ] Abrir a ficha de BASS → condições, interpretação, Terra, fontes, texto PSI.
- [ ] Mapa O₂×P mostra as 12 heróis e as zonas com fonte; clique abre a ficha.
- [ ] Comparar SAME × SAME-R, BASS × SAFFIRE, FLEX × CFI → diff + nota curada.
- [ ] Earth: clicar "detector fumaça/poeira" → SAME/SAME-R destacados + link Spinoff.
- [ ] Ask PSI: 8 perguntas de demo respondem com `[n]` e cartões de fonte; follow-up funciona; pergunta fora de escopo é recusada; pergunta sem dado responde "não há dado PSI curado".
- [ ] Baixar JSON e CSV do catálogo.
- [ ] Trocar EN ↔ PT.
- [ ] 12+ fichas `complete`, 8+ com `earth_applications`.
- [ ] CI verde; smoke E2E verde; `rag:eval` 12/12.
- [ ] (se passou no portão) 10 cenários do Caio rodando na UI com PSI-IDs visíveis.

---

## 18. Pendências conhecidas

- **PSI-IDs e URLs** de todas as heróis: descobrir com o scraper (`_index.json`) e conferir à mão.
- Valores e fontes das **atmosferas de referência** (Terra/ISS, habitat lunar, traje).
- URLs dos **Spinoffs** (detector, cilindros, vestuário) e fonte da **névoa fina de água** (o PLANO não traz link).
- Vocabulário `material_class`/`prediction_tags` aguardando confirmação do Caio (H+8).
- **Idioma da curadoria:** a DIVISAO previa interpretação em PT; este SPEC decidiu **fichas em inglês** (jurados globais). A curadoria pode rascunhar em PT e traduzir.
- Decisão do portão do Scenario (H+20).
- Calibrar `RAG_MIN_SIMILARITY` e `ANTHROPIC_EFFORT` com o `rag:eval`.
- Confirmar a forma exata dos blocos `search_result` + citations e do `fallbacks` no SDK TypeScript (skill `claude-api` / docs ao vivo) antes do M3.
- Verificar se o PSI é raspável (M1).
- Fora do escopo agora: slides, texto da submissão, logo (Beatriz/Pedro após o freeze).

---

## 19. Referências

- Desafio: NASA Space Apps Challenge 2026 — *Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data*
- NASA PSI — Combustion: https://psi.nasa.gov/physci/repo/search?q=combustion
- NASA Combustion Science (Glenn): https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/
- ScienceCast (chama na ISS): https://www.youtube.com/watch?v=W1oXykoz9zg
- Apollo 1: https://sma.nasa.gov/sma-disciplines/accllp/apollo-1 · Apollo 13: https://sma.nasa.gov/sma-disciplines/accllp/apollo-13
- Incêndio na Mir (1997): https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/
- NASA Spinoff (candidatos, conferir): https://spinoff.nasa.gov/node/9582 · https://spinoff.nasa.gov/node/9407 · https://spinoff.nasa.gov/node/9918
- Claude API (citations com `search_result`, streaming, fallbacks): skill `claude-api` + https://platform.claude.com/docs
- Supabase pgvector: https://supabase.com/docs/guides/ai
- OpenAI embeddings: https://platform.openai.com/docs/guides/embeddings
