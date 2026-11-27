import { DEFAULT_SETTINGS } from "./settings";

export type ScoringConfig = typeof DEFAULT_SETTINGS.scoring;

export type ScoringQuestion = {
  id: string;
  weight: number;
  response_type: string;
  section: string;
  category: string;
  mandatory: number;
  evidence_required: string;
  risk_level: string;
  text: string;
};

export type ScoringResponse = {
  question_id: string;
  result: string | null;
  numeric_value: number | null;
  text_value: string | null;
  amount_kobo: number | null;
  document_count?: number;
};

export function resultPercent(result: string | null | undefined, config: ScoringConfig = DEFAULT_SETTINGS.scoring) {
  switch (result) {
    case "compliant":
    case "yes":
      return config.compliant;
    case "partial":
      return config.partial;
    case "noncompliant":
    case "no":
    case "investigation":
      return config.noncompliant;
    case "na":
      return null;
    default:
      return null;
  }
}

export function isScoredQuestion(type: string) {
  return type === "compliance" || type === "yes_no";
}

export function isAnswered(question: ScoringQuestion, response: ScoringResponse | undefined) {
  if (!response) return false;
  if (question.response_type === "numeric" || question.response_type === "financial") {
    return response.numeric_value != null || response.amount_kobo != null || Boolean(response.result);
  }
  if (question.response_type === "text" || question.response_type === "date") {
    return Boolean(response.text_value?.trim()) || Boolean(response.result);
  }
  return Boolean(response.result);
}

export function evidenceSatisfied(question: ScoringQuestion, response: ScoringResponse | undefined) {
  if (!question.evidence_required || question.evidence_required === "none") return true;
  if (response?.result === "na") return true;
  return (response?.document_count ?? 0) > 0;
}

export type ScoreBreakdown = {
  score: number;
  complianceRate: number;
  answered: number;
  applicable: number;
  total: number;
  earnedWeight: number;
  totalWeight: number;
  sections: { section: string; score: number; answered: number; total: number }[];
  issues: { question: ScoringQuestion; response?: ScoringResponse; reason: "unanswered" | "evidence" | "noncompliant" | "investigation" }[];
};

export function calculateAuditScore(
  questions: ScoringQuestion[],
  responses: ScoringResponse[],
  config: ScoringConfig = DEFAULT_SETTINGS.scoring,
): ScoreBreakdown {
  const byQuestion = new Map(responses.map((r) => [r.question_id, r]));
  let earnedWeight = 0;
  let totalWeight = 0;
  let answered = 0;
  let applicable = 0;
  let compliantCount = 0;
  const sectionMap = new Map<string, { earned: number; weight: number; answered: number; total: number }>();
  const issues: ScoreBreakdown["issues"] = [];

  for (const q of questions) {
    const response = byQuestion.get(q.id);
    const section = sectionMap.get(q.section) ?? { earned: 0, weight: 0, answered: 0, total: 0 };
    section.total++;
    if (isAnswered(q, response)) {
      answered++;
      section.answered++;
    } else if (q.mandatory) {
      issues.push({ question: q, response, reason: "unanswered" });
    }
    if (q.evidence_required !== "none" && isAnswered(q, response) && !evidenceSatisfied(q, response)) {
      issues.push({ question: q, response, reason: "evidence" });
    }
    if ((response?.result === "noncompliant" || response?.result === "no") && isScoredQuestion(q.response_type)) {
      issues.push({ question: q, response, reason: "noncompliant" });
    }
    if (response?.result === "investigation") {
      issues.push({ question: q, response, reason: "investigation" });
    }
    if (!isScoredQuestion(q.response_type)) {
      sectionMap.set(q.section, section);
      continue;
    }
    if (!response?.result) {
      sectionMap.set(q.section, section);
      continue;
    }
    const percent = resultPercent(response.result, config);
    if (percent == null) {
      sectionMap.set(q.section, section);
      continue;
    }
    applicable++;
    compliantCount += percent / 100;
    const weight = Math.max(1, q.weight || 1);
    totalWeight += weight;
    section.weight += weight;
    const points = (weight * percent) / 100;
    earnedWeight += points;
    section.earned += points;
    sectionMap.set(q.section, section);
  }

  const sections = [...sectionMap.entries()].map(([section, value]) => ({
    section,
    score: value.weight > 0 ? Math.round((value.earned / value.weight) * 1000) / 10 : 0,
    answered: value.answered,
    total: value.total,
  }));

  return {
    score: totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 1000) / 10 : 0,
    complianceRate: applicable > 0 ? Math.round((compliantCount / applicable) * 1000) / 10 : 0,
    answered,
    applicable,
    total: questions.length,
    earnedWeight,
    totalWeight,
    sections,
    issues,
  };
}

export function completeness(questions: ScoringQuestion[], responses: ScoringResponse[]) {
  const map = new Map(responses.map((r) => [r.question_id, r]));
  let answered = 0;
  let missingMandatory = 0;
  let missingEvidence = 0;
  for (const q of questions) {
    const response = map.get(q.id);
    const ok = isAnswered(q, response);
    if (ok) answered++;
    if (q.mandatory && !ok) missingMandatory++;
    if (q.evidence_required !== "none" && ok && !evidenceSatisfied(q, response)) missingEvidence++;
  }
  return {
    answered,
    total: questions.length,
    missingMandatory,
    missingEvidence,
    percent: questions.length ? Math.round((answered / questions.length) * 100) : 0,
  };
}
