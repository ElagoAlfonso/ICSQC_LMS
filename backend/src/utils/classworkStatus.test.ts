import { describe, expect, it } from "bun:test";
import { canStudentSubmitClasswork, getStudentClassworkStatus } from "./classworkStatus";

describe("classwork status logic", () => {
  it("treats overdue missed work as missing when the student is not enrolled or has no submission", () => {
    const state = getStudentClassworkStatus({
      dueDate: new Date("2024-09-30T23:59:00Z"),
      now: new Date("2024-10-01T08:00:00Z"),
      hasSubmission: false,
      allowLateSubmission: false,
    });

    expect(state.status).toBe("missing");
    expect(state.canSubmit).toBe(false);
  });

  it("keeps late submission open when late is allowed but preserves the original due date", () => {
    const state = getStudentClassworkStatus({
      dueDate: new Date("2024-09-30T23:59:00Z"),
      now: new Date("2024-10-01T08:00:00Z"),
      hasSubmission: false,
      allowLateSubmission: true,
    });

    expect(state.status).toBe("past_due");
    expect(state.canSubmit).toBe(true);
    expect(state.isLateSubmission).toBe(true);
  });

  it("marks done-late only when the actual submission time is after the due date", () => {
    const onTime = getStudentClassworkStatus({
      dueDate: new Date("2024-09-30T23:59:00Z"),
      now: new Date("2024-10-01T08:00:00Z"),
      hasSubmission: true,
      submissionTime: new Date("2024-09-30T22:00:00Z"),
      allowLateSubmission: false,
    });

    const late = getStudentClassworkStatus({
      dueDate: new Date("2024-09-30T23:59:00Z"),
      now: new Date("2024-10-01T08:00:00Z"),
      hasSubmission: true,
      submissionTime: new Date("2024-10-01T08:00:00Z"),
      allowLateSubmission: true,
    });

    expect(onTime.status).toBe("done");
    expect(late.status).toBe("done_late");
    expect(late.isLateSubmission).toBe(true);
  });

  it("does not allow submissions after the due date when late submission is off", () => {
    const canSubmit = canStudentSubmitClasswork({
      dueDate: new Date("2024-09-30T23:59:00Z"),
      now: new Date("2024-10-01T08:00:00Z"),
      allowLateSubmission: false,
      hasSubmission: false,
    });

    expect(canSubmit).toBe(false);
  });
});
