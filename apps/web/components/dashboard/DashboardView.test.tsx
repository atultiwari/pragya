import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DashboardCourse, Overview } from "@/lib/dashboard";
import { DashboardView } from "./DashboardView";

const now = new Date(2026, 9, 30, 9, 0);

const course = (overrides: Partial<DashboardCourse> = {}): DashboardCourse => ({
  slug: "path",
  title: "General Pathology",
  lessonsTotal: 4,
  lessonsCompleted: 1,
  nextLesson: { slug: "necrosis", title: "Necrosis" },
  lastActivityAt: new Date(2026, 9, 29, 12, 0).toISOString(),
  practice: null,
  ...overrides,
});

const render = (overview: Overview) =>
  renderToStaticMarkup(<DashboardView overview={overview} now={now} />);

describe("DashboardView", () => {
  it("invites a learner with no courses to browse the catalogue", () => {
    const html = render({ courses: [], resume: null });
    expect(html).toContain("No courses yet");
    expect(html).toContain('href="/courses"');
  });

  it("shows where to resume, each course's progress and the next lesson", () => {
    const html = render({
      courses: [course()],
      resume: {
        courseSlug: "path",
        courseTitle: "General Pathology",
        lessonSlug: "necrosis",
        lessonTitle: "Necrosis",
      },
    });
    expect(html).toContain("Continue where you left off");
    expect(html).toContain('href="/courses/path/necrosis"');
    expect(html).toContain("1 of 4 lessons complete · active yesterday");
    expect(html).toContain('aria-valuenow="25"');
    expect(html).toContain("width:25%");
    expect(html).toContain("No practice answers yet.");
  });

  it("marks finished courses and breaks practice accuracy down by lesson", () => {
    const html = render({
      courses: [
        course({
          lessonsCompleted: 4,
          nextLesson: null,
          practice: {
            attempted: 6,
            graded: 4,
            correct: 3,
            accuracy: 0.75,
            lessons: [
              {
                slug: "a",
                title: "Cell injury",
                attempted: 4,
                graded: 4,
                correct: 3,
                accuracy: 0.75,
              },
              { slug: "b", title: "Essay", attempted: 2, graded: 0, correct: 0, accuracy: null },
            ],
          },
        }),
      ],
      resume: null,
    });
    expect(html).not.toContain("Continue where you left off");
    expect(html).toContain("Course complete");
    expect(html).toContain("<strong>75%</strong>");
    expect(html).toContain("3 of 4 graded, 6 answered");
    expect(html).toContain("Cell injury");
    expect(html).toContain("—");
  });

  it("escapes course titles rather than rendering them as markup", () => {
    const html = render({
      courses: [course({ title: "<img src=x onerror=alert(1)>" })],
      resume: null,
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
