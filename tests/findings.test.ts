import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";

const file = path.join(__dirname, "..", "data", "findings.yaml");

type Finding = {
  id: string;
  kind: "myth" | "finding";
  pillars: string[];
  page: number;
  psi: string[];
};

describe("findings.yaml", () => {
  const data = YAML.parse(readFileSync(file, "utf8")) as {
    document: { id: string };
    findings: Finding[];
  };

  it("keeps the three NASA p.35/31 myths and sourced PSI ids only", () => {
    expect(data.document.id).toBe("nasa-mini-book-2015");
    const myths = data.findings.filter((f) => f.kind === "myth");
    expect(myths.map((f) => f.id)).toEqual(["myth-steady-fire", "myth-shut-vent", "myth-earth-conservative"]);
    expect(data.findings.every((f) => f.psi.every((id) => /^PSI-\d+$/.test(id)))).toBe(true);
    expect(data.findings.find((f) => f.id === "myth-steady-fire")!.psi).toEqual([]);
  });

  it("lets a finding sit in more than one pillar", () => {
    const flex = data.findings.find((f) => f.id === "finding-flex-loi")!;
    expect(flex.pillars).toEqual(["suppression", "prevention"]);
    const detection = data.findings.filter((f) => f.pillars.includes("detection"));
    expect(detection.map((f) => f.id)).toEqual(["finding-wrong-particles"]);
  });
});
