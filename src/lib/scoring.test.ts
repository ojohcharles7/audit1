import { describe, expect, it } from "vitest";
import { calculateAuditScore, completeness, evidenceSatisfied, resultPercent } from "./scoring";

const questions = [
  { id: "q1", weight: 3, response_type: "compliance", section: "Cash", category: "financial", mandatory: 1, evidence_required: "document", risk_level: "critical", text: "Cash reconciled" },
  { id: "q2", weight: 2, response_type: "yes_no", section: "Cash", category: "financial", mandatory: 1, evidence_required: "none", risk_level: "high", text: "Daily report signed" },
  { id: "q3", weight: 1, response_type: "compliance", section: "Cash", category: "financial", mandatory: 1, evidence_required: "none", risk_level: "low", text: "Not applicable control" },
  { id: "q4", weight: 2, response_type: "numeric", section: "Stock", category: "inventory", mandatory: 1, evidence_required: "none", risk_level: "high", text: "Stock variance" },
];

const responses = [
  { question_id: "q1", result: "compliant", numeric_value: null, text_value: null, amount_kobo: null, document_count: 1 },
  { question_id: "q2", result: "partial", numeric_value: null, text_value: null, amount_kobo: null, document_count: 0 },
  { question_id: "q3", result: "na", numeric_value: null, text_value: null, amount_kobo: null, document_count: 0 },
  { question_id: "q4", result: null, numeric_value: 12, text_value: null, amount_kobo: null, document_count: 0 },
];

describe("audit scoring", () => {
  it("weights scored questions and excludes N/A", () => {
    const result = calculateAuditScore(questions, responses);
    expect(result.score).toBe(80);
    expect(result.complianceRate).toBe(75);
    expect(result.totalWeight).toBe(5);
    expect(result.answered).toBe(4);
  });

  it("maps results to configured percentages", () => {
    expect(resultPercent("compliant")).toBe(100);
    expect(resultPercent("partial")).toBe(50);
    expect(resultPercent("noncompliant")).toBe(0);
    expect(resultPercent("na")).toBeNull();
  });

  it("flags missing evidence except when N/A", () => {
    expect(evidenceSatisfied(questions[0]!, { ...responses[0]!, document_count: 0 })).toBe(false);
    expect(evidenceSatisfied(questions[0]!, responses[0]!)).toBe(true);
    expect(evidenceSatisfied(questions[0]!, { ...responses[0]!, result: "na" })).toBe(true);
  });

  it("reports mandatory and evidence gaps for submission", () => {
    const result = completeness(questions, responses.slice(0, 2));
    expect(result.missingMandatory).toBe(2);
    expect(result.answered).toBe(2);
  });
});
