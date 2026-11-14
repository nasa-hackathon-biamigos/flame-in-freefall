import { getTranslations } from "next-intl/server";
import type { Investigation } from "@/lib/catalog/build";
import { termLabel, type UiLocale } from "@/lib/catalog/labels";
import type { Vocab, VocabKey } from "@/lib/catalog/vocab";
import { formatRange, mapRange, psiToKpa } from "@/lib/units";

export async function ConditionsTable({
  inv,
  vocab,
  locale,
}: {
  inv: Investigation;
  vocab: Vocab;
  locale: UiLocale;
}) {
  const t = await getTranslations("investigation");
  const a = inv.atmosphere;
  const terms = (key: VocabKey, ids: string[]) =>
    ids.map((id) => termLabel(vocab, key, id, locale)).join(", ");
  const psi = formatRange(a.pressure_psi, locale);
  const kpa = formatRange(mapRange(a.pressure_psi, psiToKpa), locale, 0);

  const rows: Array<[string, string | null, boolean?]> = [
    [t("conditions.o2"), formatRange(a.o2_percent, locale), true],
    [t("conditions.pressure"), psi ? `${psi} psia (${kpa} kPa)` : null, true],
    [t("conditions.diluents"), a.diluents.join(", ")],
    [t("conditions.flow"), formatRange(a.flow_velocity_cm_s, locale), true],
    [t("conditions.flowNotes"), a.flow_notes],
    [t("conditions.gravity"), terms("gravity", inv.gravity)],
    [t("conditions.platform"), inv.platform ? termLabel(vocab, "platform", inv.platform, locale) : null],
    [t("conditions.hardware"), terms("hardware", inv.hardware)],
    [t("conditions.material"), terms("material_class", inv.material_class)],
    [t("conditions.solidForm"), terms("solid_form", inv.solid_form)],
    [t("conditions.fuels"), inv.fuels.join(", ")],
    [t("conditions.geometry"), inv.sample_geometry],
    [t("conditions.sensors"), inv.sensors.join(", ")],
    [t("conditions.measured"), inv.measured_variables.join(", ")],
    [t("conditions.evidence"), a.evidence],
  ];

  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, value, mono]) => (
          <tr key={label} className="border-b last:border-0">
            <th scope="row" className="w-2/5 py-2 pr-3 text-left align-top font-normal text-muted-foreground">
              {label}
            </th>
            <td className={value ? (mono ? "py-2 font-mono" : "py-2") : "py-2 italic text-muted-foreground"}>
              {value || t("notReported")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
