import { describe, expect, it } from "bun:test";
import { buildTeacherAccessibleExamFilter } from "./combined";

describe("teacher exam access filter", () => {
  it("includes exams created by the teacher, in their classes, and in their teaching subjects", () => {
    const filter = buildTeacherAccessibleExamFilter("teacher-1", ["class-1", "class-2"], ["subject-1", "subject-2"]);

    expect(filter).toEqual({
      $or: [
        { createdBy: "teacher-1" },
        { class: { $in: ["class-1", "class-2"] } },
        { subject: { $in: ["subject-1", "subject-2"] } },
      ],
    });
  });

  it("falls back to createdBy-only when the teacher has no assigned classes or subjects", () => {
    const filter = buildTeacherAccessibleExamFilter("teacher-2", [], []);

    expect(filter).toEqual({ createdBy: "teacher-2" });
  });
});
