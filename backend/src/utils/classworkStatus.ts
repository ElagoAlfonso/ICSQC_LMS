export type StudentClassworkStatus = "assigned" | "missing" | "done" | "done_late" | "past_due";

export interface StudentClassworkStatusInput {
  dueDate?: Date | string | null;
  allowLateSubmission?: boolean;
  hasSubmission?: boolean;
  submissionTime?: Date | string | null;
  now?: Date | string;
}

export interface StudentClassworkStatusResult {
  status: StudentClassworkStatus;
  canSubmit: boolean;
  isLateSubmission: boolean;
  duePassed: boolean;
}

const toDate = (value?: Date | string | null): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getStudentClassworkStatus = ({
  dueDate,
  allowLateSubmission = false,
  hasSubmission = false,
  submissionTime,
  now,
}: StudentClassworkStatusInput): StudentClassworkStatusResult => {
  const due = toDate(dueDate);
  const currentTime = toDate(now) ?? new Date();

  if (hasSubmission && submissionTime) {
    const submittedAt = toDate(submissionTime);
    const isLateSubmission = Boolean(due && submittedAt && submittedAt.getTime() > due.getTime());

    return {
      status: isLateSubmission ? "done_late" : "done",
      canSubmit: false,
      isLateSubmission,
      duePassed: Boolean(due && currentTime.getTime() > due.getTime()),
    };
  }

  if (!due) {
    return {
      status: "assigned",
      canSubmit: true,
      isLateSubmission: false,
      duePassed: false,
    };
  }

  const duePassed = currentTime.getTime() > due.getTime();

  if (duePassed && allowLateSubmission) {
    return {
      status: "past_due",
      canSubmit: true,
      isLateSubmission: true,
      duePassed: true,
    };
  }

  if (duePassed) {
    return {
      status: "missing",
      canSubmit: false,
      isLateSubmission: false,
      duePassed: true,
    };
  }

  return {
    status: "assigned",
    canSubmit: true,
    isLateSubmission: false,
    duePassed: false,
  };
};

export const canStudentSubmitClasswork = (params: StudentClassworkStatusInput): boolean =>
  getStudentClassworkStatus(params).canSubmit;
