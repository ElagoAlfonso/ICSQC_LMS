import { describe, expect, it } from "bun:test";
import { canAccessClassworkSubmissionAttachment } from "./attachment";

describe("classwork submission attachment access", () => {
  it("allows the student who owns the submission", () => {
    expect(canAccessClassworkSubmissionAttachment({
      role: "student",
      userId: "student-1",
      studentId: "student-1",
    })).toBe(true);
  });

  it("allows admins and the classwork creator", () => {
    expect(canAccessClassworkSubmissionAttachment({
      role: "admin",
      userId: "admin-1",
      studentId: "student-1",
    })).toBe(true);
    expect(canAccessClassworkSubmissionAttachment({
      role: "teacher",
      userId: "teacher-1",
      studentId: "student-1",
      classworkCreatorId: "teacher-1",
    })).toBe(true);
  });

  it("allows assigned class teachers but denies unrelated users", () => {
    expect(canAccessClassworkSubmissionAttachment({
      role: "teacher",
      userId: "co-teacher-1",
      studentId: "student-1",
      isAssignedTeacher: true,
    })).toBe(true);
    expect(canAccessClassworkSubmissionAttachment({
      role: "teacher",
      userId: "teacher-2",
      studentId: "student-1",
      classworkCreatorId: "teacher-1",
    })).toBe(false);
    expect(canAccessClassworkSubmissionAttachment({
      role: "student",
      userId: "student-2",
      studentId: "student-1",
    })).toBe(false);
  });
});