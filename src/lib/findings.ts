import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import YAML from "yaml";

export type FindingKind = "myth" | "finding";
export type PillarId = "prevention" | "detection" | "suppression";
export type LocaleText = { en: string; "pt-BR": string };

export type Finding = {
  id: string;
  kind: FindingKind;
  pillars: PillarId[];
  page: number;
  psi: string[];
  explore: string;
  myth: LocaleText;
  truth: LocaleText;
};

export type FindingsFile = {
  document: { id: string; label: string; caveat: LocaleText };
  findings: Finding[];
};

const file = path.join(process.cwd(), "data", "findings.yaml");

let cached: FindingsFile | null = null;

export function loadFindings(): FindingsFile {
  if (cached) return cached;
  cached = YAML.parse(readFileSync(file, "utf8")) as FindingsFile;
  return cached;
}

export function findingsFor(pillar: PillarId | "all"): Finding[] {
  const { findings } = loadFindings();
  if (pillar === "all") return findings;
  return findings.filter((f) => f.pillars.includes(pillar));
}

export function parseDashPillar(raw: string | string[] | undefined): PillarId | "all" {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "prevention" || v === "detection" || v === "suppression") return v;
  return "all";
}
