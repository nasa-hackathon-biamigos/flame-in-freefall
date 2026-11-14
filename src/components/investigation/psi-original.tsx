import { ExternalLink } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PSI_SECTION_KEYS, type PsiRaw } from "@/lib/catalog/psi";
import { parseCsv } from "@/lib/csv";

const MAX_ROWS = 50;

function CsvTable({
  csv,
  caption,
  rowsShownLabel,
}: {
  csv: string;
  caption: string;
  rowsShownLabel: (shown: number, total: number) => string;
}) {
  const [header, ...rows] = parseCsv(csv);
  if (!header) return null;
  const shown = rows.slice(0, MAX_ROWS);
  return (
    <div className="mt-2">
      <div className="max-h-96 overflow-auto rounded-md border">
        <table className="w-full text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-card">
            <tr>
              {header.map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  className="border-b px-2 py-1.5 text-left font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            {shown.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                {header.map((_, j) => (
                  <td key={j} className="px-2 py-1 align-top">
                    {r[j] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_ROWS && (
        <p className="mt-1 text-xs text-muted-foreground">{rowsShownLabel(MAX_ROWS, rows.length)}</p>
      )}
    </div>
  );
}

/** The raw PSI record, collapsed by default (docs/SPEC.md §10.5). Plain text, never HTML. */
export async function PsiOriginal({ psi }: { psi: PsiRaw }) {
  const t = await getTranslations("investigation.psi");
  const locale = await getLocale();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(psi.fetched_at));

  return (
    <div className="space-y-6 text-sm">
      <p className="text-muted-foreground">
        {t("intro", { license: psi.license?.id ?? "—", version: psi.psi_version ?? "—", date })}
        {psi.doi && (
          <>
            {" "}
            DOI:{" "}
            <a
              href={`https://doi.org/${psi.doi}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-plasma hover:underline"
            >
              {psi.doi}
            </a>
          </>
        )}
      </p>

      {PSI_SECTION_KEYS.filter((k) => psi.sections[k]).map((k) => (
        <div key={k}>
          <h4 className="font-medium">{t(k)}</h4>
          <p className="mt-1 whitespace-pre-line leading-relaxed text-foreground/85">{psi.sections[k]}</p>
        </div>
      ))}

      {psi.metadata.hardware && (
        <div>
          <h4 className="font-medium">{t("hardware")}</h4>
          <p className="mt-1">
            {psi.metadata.hardware.link ? (
              <a
                href={psi.metadata.hardware.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-plasma hover:underline"
              >
                {psi.metadata.hardware.name} <ExternalLink aria-hidden className="size-3" />
              </a>
            ) : (
              psi.metadata.hardware.name
            )}
          </p>
        </div>
      )}

      {psi.experimental_tables.length > 0 && (
        <div>
          <h4 className="font-medium">{t("tables")}</h4>
          {psi.experimental_tables.map((tb) => (
            <div key={tb.file_name} className="mt-3">
              <p className="font-mono text-xs text-muted-foreground">{tb.file_name}</p>
              <CsvTable
                csv={tb.csv}
                caption={tb.file_name}
                rowsShownLabel={(shown, total) => t("rowsShown", { shown, total })}
              />
            </div>
          ))}
        </div>
      )}

      {psi.publications.length > 0 && (
        <div>
          <h4 className="font-medium">{t("publications")}</h4>
          <ul className="mt-2 space-y-2">
            {psi.publications.map((p, i) => (
              <li key={i}>
                <span>{p.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {p.authors}
                  {p.doi && (
                    <>
                      {" · "}
                      <a
                        href={`https://doi.org/${p.doi}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-plasma hover:underline"
                      >
                        doi:{p.doi}
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
