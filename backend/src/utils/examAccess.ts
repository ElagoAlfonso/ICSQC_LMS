const toDateTime = (value: Date | string | null | undefined, endOfDay = false) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
  }

  return date;
};

const toIdString = (value: any) => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

export const normalizeExamQuestions = (questions: any[] = []) =>
  questions.map((question) => ({
    ...question,
    type: question?.type || 'multiple_choice',
    choices: Array.isArray(question?.choices) ? question.choices : [],
    correctAnswer: typeof question?.correctAnswer === 'string' ? question.correctAnswer : '',
    points: Number(question?.points ?? 1),
    image: question?.image ?? null,
    imageName: question?.imageName ?? null,
    attachments: Array.isArray(question?.attachments) ? question.attachments : [],
  }));

export const calculateExamDeadline = (startedAt: Date, durationMinutes: number, availabilityEnd: Date) =>
  new Date(Math.min(startedAt.getTime() + durationMinutes * 60_000, availabilityEnd.getTime()));

export const createQuestionOrder = (questionCount: number, randomize: boolean, random = Math.random) => {
  const order = Array.from({ length: questionCount }, (_, index) => index);
  if (!randomize) return order;

  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const currentValue = order[index] ?? index;
    const swapValue = order[swapIndex] ?? swapIndex;
    order[index] = swapValue;
    order[swapIndex] = currentValue;
  }
  return order;
};

export const isExamAvailableToStudent = (
  exam: {
    status?: string;
    class?: string | { toString(): string };
    publishDate?: Date | string | null;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
  } | null,
  _studentId: string,
  studentClassId?: string | null
) => {
  if (!exam) return false;

  if (exam.status !== 'published') return false;
  if (studentClassId && toIdString(exam.class) !== studentClassId) return false;

  const publishDate = toDateTime(exam.publishDate);
  if (publishDate && publishDate.getTime() > Date.now()) return false;

  const startDate = toDateTime(exam.startDate);
  const endDate = toDateTime(exam.endDate, true);
  if (startDate && startDate.getTime() > Date.now()) return false;
  if (endDate && endDate.getTime() < Date.now()) return false;

  return true;
};
