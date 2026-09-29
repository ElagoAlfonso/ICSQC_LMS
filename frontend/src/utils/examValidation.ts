import type { Question } from '../types';

export type ExamValidationErrors = Partial<Record<string, string>>;
export type ExamValidationStage = 'overview' | 'questions' | 'settings' | 'publish';

interface ExamDraftLike {
  title: string;
  class: string;
  subject: string;
  academicYear: string;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  duration: string | number;
  passingScore: string | number;
}

const isValidNumber = (value: string | number | undefined, min: number, max?: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return false;
  if (parsed < min) return false;
  if (max !== undefined && parsed > max) return false;
  return true;
};

export const getExamValidationErrors = ({
  form,
  questions,
  stage = 'publish',
}: {
  form: ExamDraftLike;
  questions: Question[];
  stage?: ExamValidationStage;
}): ExamValidationErrors => {
  const errors: ExamValidationErrors = {};
  const requiresSchedule = stage === 'settings' || stage === 'publish';
  const requiresQuestions = stage === 'questions' || stage === 'settings' || stage === 'publish';

  if (!form.title?.trim()) errors.title = 'Exam title is required.';
  if (!form.class) errors.class = 'Class is required.';
  if (!form.subject) errors.subject = 'Subject is required.';
  if (!form.academicYear) errors.academicYear = 'Academic year is required.';

  if (requiresSchedule) {
    if (!form.startDate) errors.startDate = 'Start date is required.';
    if (!form.startTime) errors.startTime = 'Start time is required.';
    if (!form.endDate) errors.endDate = 'End date is required.';
    if (!form.endTime) errors.endTime = 'End time is required.';
    if (!isValidNumber(form.duration, 1)) errors.duration = 'Duration must be greater than 0.';
    if (!isValidNumber(form.passingScore, 0, 100)) errors.passingScore = 'Passing score is required.';

    if (form.startDate && form.startTime && form.endDate && form.endTime) {
      const start = new Date(`${form.startDate}T${form.startTime}`);
      const end = new Date(`${form.endDate}T${form.endTime}`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        errors.dateRange = 'Start and end date/time values must be valid.';
      } else if (end < start) {
        errors.dateRange = 'End date/time must be on or after the start date/time.';
      }
    }
  }

  if (requiresQuestions && !questions.length) {
    errors.questions = 'Add at least one question.';
    return errors;
  }

  if (requiresQuestions) {
    questions.forEach((question, index) => {
      const questionPrefix = `question_${index}`;

      if (!question.question?.trim()) {
        errors[`${questionPrefix}_text`] = 'Question text is required.';
      }

      if (!question.type) {
        errors[`${questionPrefix}_type`] = 'Question type is required.';
      }

      if (!isValidNumber(question.points, 1)) {
        errors[`${questionPrefix}_points`] = 'Point value is required.';
      }

      if (['multiple_choice', 'true_false', 'short_answer'].includes(question.type)) {
        if (!String(question.correctAnswer ?? '').trim()) {
          errors[`${questionPrefix}_answer`] = 'Correct answer is required.';
        }
      }

      if (question.type === 'multiple_choice') {
        const validChoices = (question.choices ?? []).map((choice) => choice.trim()).filter(Boolean);
        if (validChoices.length < 2) {
          errors[`${questionPrefix}_choices`] = 'Multiple choice questions need at least two options.';
        }

        const answerMatch = (question.choices ?? []).some((choice) => choice.trim() === String(question.correctAnswer ?? '').trim());
        if (!answerMatch && String(question.correctAnswer ?? '').trim()) {
          errors[`${questionPrefix}_answer`] = 'Select a correct answer from the available choices.';
        }
      }
    });
  }

  return errors;
};

export const hasExamValidationErrors = (errors: ExamValidationErrors) =>
  Object.keys(errors).length > 0;
