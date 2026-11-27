import { DEFAULT_SETTINGS } from "./settings";

export type RiskSettings = typeof DEFAULT_SETTINGS.risk;

export function computeRisk(
  likelihood: number,
  impact: number,
  effectiveness: string,
  settings: RiskSettings = DEFAULT_SETTINGS.risk,
) {
  const inherent = Math.max(1, Math.min(5, likelihood)) * Math.max(1, Math.min(5, impact));
  const factor =
    settings.controlFactors[effectiveness as keyof typeof settings.controlFactors] ??
    settings.controlFactors.satisfactory;
  const residual = Math.max(1, Math.round((inherent * factor) / 100));
  return { inherent, residual, rating: classifyRisk(residual, settings) };
}

export function classifyRisk(score: number, settings: RiskSettings = DEFAULT_SETTINGS.risk) {
  if (score >= settings.critical) return "critical";
  if (score >= settings.high) return "high";
  if (score >= settings.medium) return "medium";
  return "low";
}

export function riskScoreFromSeverity(severity: string) {
  switch (severity) {
    case "critical":
      return 25;
    case "high":
      return 16;
    case "medium":
      return 9;
    case "low":
      return 4;
    default:
      return 1;
  }
}

export const HEATMAP_COLORS: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-400 text-amber-950",
  low: "bg-emerald-500 text-white",
  none: "bg-slate-100 text-slate-600",
};
