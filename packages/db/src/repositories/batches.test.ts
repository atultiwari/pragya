import { describe, expect, it } from "vitest";
import { parseCreateBatchInput } from "./batches.js";

describe("parseCreateBatchInput", () => {
  it("trims and accepts a valid batch", () => {
    expect(parseCreateBatchInput({ name: "  MBBS 2024 A ", cohort: "MBBS 2024" })).toEqual({
      name: "MBBS 2024 A",
      cohort: "MBBS 2024",
    });
  });

  it("allows the cohort to be omitted", () => {
    expect(parseCreateBatchInput({ name: "Phase II" })).toEqual({ name: "Phase II" });
  });

  it.each([{}, { name: "" }, { name: "x".repeat(121) }, { name: 42 }])("rejects %j", (input) => {
    expect(() => parseCreateBatchInput(input)).toThrow();
  });

  it("ignores an institute id smuggled into the input", () => {
    expect(parseCreateBatchInput({ name: "A", instituteId: "inst_other" })).toEqual({ name: "A" });
  });
});
