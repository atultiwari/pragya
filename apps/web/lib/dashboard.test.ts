import { describe, expect, it } from "vitest";
import {
  completionPercent,
  courseHref,
  formatAccuracy,
  formatLastActive,
  lessonHref,
} from "./dashboard";

describe("completionPercent", () => {
  it("rounds to a whole percent and handles empty courses", () => {
    expect(completionPercent(1, 3)).toBe(33);
    expect(completionPercent(2, 3)).toBe(67);
    expect(completionPercent(3, 3)).toBe(100);
    expect(completionPercent(0, 0)).toBe(0);
    expect(completionPercent(5, 3)).toBe(100);
  });
});

describe("formatAccuracy", () => {
  it("shows a percent, or a dash before anything is graded", () => {
    expect(formatAccuracy(0.75)).toBe("75%");
    expect(formatAccuracy(1 / 3)).toBe("33%");
    expect(formatAccuracy(0)).toBe("0%");
    expect(formatAccuracy(null)).toBe("—");
  });
});

describe("formatLastActive", () => {
  const now = new Date(2026, 9, 30, 9, 0);
  it("describes recent days in words and older ones as a date", () => {
    expect(formatLastActive(new Date(2026, 9, 30, 1, 0).toISOString(), now)).toBe("today");
    expect(formatLastActive(new Date(2026, 9, 29, 23, 0).toISOString(), now)).toBe("yesterday");
    expect(formatLastActive(new Date(2026, 9, 27, 12, 0).toISOString(), now)).toBe("3 days ago");
    expect(formatLastActive(new Date(2026, 9, 12, 12, 0).toISOString(), now)).toBe("12 Oct");
  });

  it("treats future times as today and ignores bad input", () => {
    expect(formatLastActive(new Date(2026, 9, 31).toISOString(), now)).toBe("today");
    expect(formatLastActive("not a date", now)).toBe("");
  });
});

describe("hrefs", () => {
  it("encodes slugs into reader paths", () => {
    expect(lessonHref("path", "cell-injury")).toBe("/courses/path/cell-injury");
    expect(lessonHref("a/b", "c?d")).toBe("/courses/a%2Fb/c%3Fd");
    expect(courseHref("path")).toBe("/courses/path");
  });
});
