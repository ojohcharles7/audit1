import { describe, expect, it } from "vitest";
import { classifyRisk, computeRisk } from "./risk";

describe("risk scoring", () => {
  it("calculates inherent and residual risk with control effect", () => {
    const result = computeRisk(4, 5, "strong");
    expect(result.inherent).toBe(20);
    expect(result.residual).toBe(5);
    expect(result.rating).toBe("medium");
  });

  it("classifies scores against configured thresholds", () => {
    expect(classifyRisk(25)).toBe("critical");
    expect(classifyRisk(20)).toBe("critical");
    expect(classifyRisk(12)).toBe("high");
    expect(classifyRisk(5)).toBe("medium");
    expect(classifyRisk(4)).toBe("low");
  });
});
