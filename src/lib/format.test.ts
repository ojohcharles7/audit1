import { describe, expect, it } from "vitest";
import { formatDate, formatMoney, isOverdue, percent } from "./format";

describe("formatting", () => {
  it("formats Naira values from kobo", () => {
    expect(formatMoney(150_000_00)).toContain("150,000");
    expect(formatMoney(2_500_000_00, true)).toBe("₦2.5m");
  });
  it("handles empty, percentage and overdue values", () => {
    expect(percent(78.4, 1)).toBe("78.4%");
    expect(formatDate(null)).toBe("—");
    expect(isOverdue("2020-01-01", "open")).toBe(true);
    expect(isOverdue("2020-01-01", "resolved")).toBe(false);
  });
});
