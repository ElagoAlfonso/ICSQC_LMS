import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import Classwork from "../models/classwork.ts";
import ExamAttempt from "../models/examAttempt.ts";
import StudentActivitySession from "../models/studentActivitySession.ts";
import { AI_CLASSWORK_RESTRICTED_MESSAGE, AI_EXAM_RESTRICTED_MESSAGE, canUseAI } from "./aiAccess.service.ts";

const student = { _id: "student-1", role: "student" } as any;

const mockNoActiveActivity = () => {
  spyOn(ExamAttempt, "exists").mockResolvedValue(null as any);
  spyOn(StudentActivitySession, "find").mockReturnValue({
    select: () => ({ lean: async () => [] }),
  } as any);
  spyOn(Classwork, "exists").mockResolvedValue(null as any);
};

afterEach(() => mock.restore());

describe("canUseAI", () => {
  it("allows a student without a current academic activity", async () => {
    mockNoActiveActivity();

    await expect(canUseAI(student)).resolves.toEqual({ allowed: true });
  });

  it("blocks an in-progress exam before checking classwork or AI availability", async () => {
    const examCheck = spyOn(ExamAttempt, "exists").mockResolvedValue({ _id: "attempt-1" } as any);
    const sessionCheck = spyOn(StudentActivitySession, "find");

    await expect(canUseAI(student)).resolves.toEqual({ allowed: false, message: AI_EXAM_RESTRICTED_MESSAGE });
    expect(examCheck).toHaveBeenCalled();
    expect(sessionCheck).not.toHaveBeenCalled();
  });

  it("blocks a student with a current restricted classwork session", async () => {
    spyOn(ExamAttempt, "exists").mockResolvedValue(null as any);
    spyOn(StudentActivitySession, "find").mockReturnValue({
      select: () => ({ lean: async () => [{ classwork: "classwork-1" }] }),
    } as any);
    spyOn(Classwork, "exists").mockResolvedValue({ _id: "classwork-1" } as any);

    await expect(canUseAI(student)).resolves.toEqual({ allowed: false, message: AI_CLASSWORK_RESTRICTED_MESSAGE });
  });

  it("does not apply student activity restrictions to teachers", async () => {
    const examCheck = spyOn(ExamAttempt, "exists");

    await expect(canUseAI({ ...student, role: "teacher" })).resolves.toEqual({ allowed: true });
    expect(examCheck).not.toHaveBeenCalled();
  });
});