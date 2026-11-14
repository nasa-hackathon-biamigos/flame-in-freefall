# Guia de curadoria — fichas

Para: Anna Luiza e Juliana (e quem ajudar). Referência completa: [SPEC §6](./SPEC.md#6-dados).

## O que já está pronto

- **As 12 fichas herói já existem** em `data/investigations/`, como **esqueletos**. Cada uma já traz `psi_id`, `psi_url`, nome oficial, sigla e a fonte PSI, copiados do próprio PSI. O resto está vazio (`null` ou `[]`) para vocês preencherem.

  | Anna Luiza | Juliana |
  |---|---|
  | `bass` (PSI-26), `spice` (PSI-107), `slice` (PSI-106), `bre` (PSI-20), `cfi-g` (PSI-159), `saffire-i` (PSI-98), `saffire-ii` (PSI-99), `saffire-iii` (PSI-100) | `same` (PSI-102), `same-r` (PSI-101), `flex` (PSI-69), `cfi` (PSI-39) |

- **O texto do PSI de cada investigação** está em `data/raw/psi/PSI-XX.json`: objectives, hypothesis, approach, research impacts (benefícios na Terra), hardware, publicações (com DOI) e as **tabelas experimentais** (amostras, materiais, fluxo de ar etc.). Comecem a leitura por aí. Não editem esses arquivos: eles são gerados pelo script.
- **A lista das 26 investigações de combustão do PSI** (para escolher as stretch) está em `data/raw/psi/_index.json`. Para abrir uma nova ficha, peçam ao Pedro: `pnpm data:scaffold PSI-25`.

## Status da ficha

| Status | Quando usar | Aparece no app? |
|---|---|---|
| `draft` | Esqueleto, ainda em preenchimento | Não |
| `partial` | Identificação conferida + pelo menos 1 pilar | Sim, com selo "curadoria parcial" |
| `complete` | Todos os campos vitais preenchidos e revisados por outra curadora | Sim, em tudo (mapa, comparador, cenário) |

O que `complete` exige: `psi_url`, 1+ `material_class`, 1+ `gravity`, O₂ e pressão (pelo menos o `min`) **com `evidence`**, `variables_changed` e `variables_fixed`, 1+ `prediction_tags`, 1+ fonte com url e as seções **Summary** e **Why it matters for crew safety** preenchidas. Se o experimento não tem atmosfera controlada (ex.: detecção), explique em `atmosphere.flow_notes` ou em `## Limitations`.

## Como editar pelo GitHub (sem instalar nada)

1. Abra o arquivo da ficha no GitHub e clique no lápis (Edit).
2. Preencha os campos. Os comentários depois do `#` dizem os valores permitidos.
3. Em "Commit changes", escolha **"Create a new branch"**, com uma mensagem como `data: fill SAME`, e abra o Pull Request.
4. O CI roda sozinho. Se houver erro, ele aparece **em português na própria linha do arquivo**, na aba "Files changed" do PR, e no resumo do job. Exemplo: `data/investigations/same.md → atmosphere.o2_percent.max: min não pode ser maior que max`.
5. Com o CI verde, o Pedro faz o merge.

Uma ficha por PR facilita a revisão.

## Regras de ouro

- **Número sem fonte não entra.** Se não achou, deixe `null`: o app mostra "não informado". Preencha `atmosphere.evidence` com a origem (seção do PSI, tabela, artigo ou URL).
- **Use só os valores do vocabulário** (`data/vocab.yaml`), por exemplo `detection` e não `detecção`. O CI lista os valores aceitos quando algo está errado.
- **Fichas em inglês.** Pode rascunhar em português e traduzir.
- **Não mude os títulos das seções** (`## Summary` etc.). Título desconhecido gera aviso e é ignorado.
- **Checklist "ficha pronta":** `data:build` verde · `complete` · PSI-ID e URL conferidos · números com `evidence` · "Why it matters" com 3–5 bullets · Terra preenchida ou `null` justificado · revisada pela outra curadora.

## Outros arquivos de vocês

- `data/reference_atmospheres.yaml` (Anna, H+8): valores de Terra/ISS, habitat lunar e traje **com `source_url`**. Sem fonte, a zona não aparece no mapa.
- `data/spinoffs/` (Juliana): copie `_template.md` para os 4 cards.
- `data/comparisons/` (Anna e Juliana): copie `_template.md` como `same--same-r.md`, `bass--saffire-i.md` e `flex--cfi.md`.
