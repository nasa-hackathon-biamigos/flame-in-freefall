# Dados tabulares PSI (amostras curadas)

Baixa **só o necessário** para análise no hackathon — não o pacote completo do repositório.

## Investigações no modo padrão (≤ **1 GB** cada)

| PSI | Foco | O que entra no download |
|-----|------|-------------------------|
| **PSI-115** | Modelagem fumaça (SAME) | `.dat` PSD, NumDen, NucRate, `nodeDiameters` (sem volumes CFD gigantes) |
| **PSI-102** | SAME / detecção | Tabela experimental + `Analyzed Data` (`.xls`/`.xlsx`) |
| **PSI-101** | SAME-R | Idem, sem engenharia/apresentações em massa |
| **PSI-117** | Cool flames / FLEX | Analyzed + relatórios pequenos |
| **PSI-142** | Cool flames (solo) | CSV/XLSX de tabelas |
| **PSI-98** | SAFFIRE-I | Telemetria tabular (sem vídeos / grades de imagem) |
| **PSI-107** | SPICE | Tabelas + analyzed (sem NEF / raw de câmera) |

**Fora do padrão:** PSI-26/25 (BASS), PSI-99/100 (SAFFIRE), PSI-39 (CFI — centenas de `.txt` de teste). Use `data/context/` para PDFs de relatório.

```bash
npm run data:download-tabular
npm run data:download-tabular -- --max-mb=1024 PSI-102
npm run data:download-tabular -- --all-hero   # antigo (não recomendado)
```

Cache da API: `data/raw/psi-cache/PSI-XX.json`.