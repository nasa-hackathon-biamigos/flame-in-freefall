import "server-only";
import type { Insights } from "./types";
import data from "./data.json";

export function loadInsights(): Insights {
  return data as Insights;
}

export function formatNm(nm: number): string {
  if (nm >= 1000) {
    const um = nm / 1000;
    const digits = Number.isInteger(um) || Math.abs(um - Math.round(um)) < 0.05 ? 0 : 1;
    return `${um.toFixed(digits)} μm`;
  }
  if (nm >= 1) return `${nm.toFixed(0)} nm`;
  return `${nm.toFixed(2)} nm`;
}

export function formatPct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

export function formatRatio(x: number): string {
  if (!Number.isFinite(x) || x <= 0) return "—";
  if (x >= 100) return `${x.toFixed(0)}×`;
  if (x >= 10) return `${x.toFixed(1)}×`;
  return `${x.toFixed(2)}×`;
}
