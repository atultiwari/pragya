import { describe, expect, it } from "vitest";
import { formatPrice } from "./format";

describe("formatPrice", () => {
  it.each([
    [0, "Free"],
    [49900, "₹499"],
    [49950, "₹499.50"],
    [12345600, "₹1,23,456"],
  ])("%i paise → %s", (paise, expected) => {
    expect(formatPrice(paise)).toBe(expected);
  });
});
