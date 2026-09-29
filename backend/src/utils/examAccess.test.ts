import { describe, expect, it } from 'bun:test';
import { calculateExamDeadline, createQuestionOrder, isExamAvailableToStudent } from './examAccess';

describe('isExamAvailableToStudent', () => {
  it('allows a published exam when the student is enrolled and the exam window is valid', () => {
    const now = new Date();
    const exam = {
      status: 'published',
      class: 'class-1',
      publishDate: new Date(now.getTime() - 60_000),
      startDate: new Date(now.getTime() - 60_000),
      endDate: new Date(now.getTime() + 60_000),
    };

    expect(isExamAvailableToStudent(exam as any, 'student-1', 'class-1')).toBe(true);
  });

  it('allows a published exam without explicit date bounds', () => {
    const exam = {
      status: 'published',
      class: 'class-1',
      publishDate: new Date(Date.now() - 60_000),
    };

    expect(isExamAvailableToStudent(exam as any, 'student-1', 'class-1')).toBe(true);
  });

  it('allows a published exam when its class is populated', () => {
    const exam = {
      status: 'published',
      class: { _id: 'class-1', name: 'Class 1' },
      publishDate: new Date(Date.now() - 60_000),
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
    };

    expect(isExamAvailableToStudent(exam as any, 'student-1', 'class-1')).toBe(true);
  });

  it('blocks a published exam when the student is not enrolled', () => {
    const exam = {
      status: 'published',
      class: 'class-1',
      publishDate: new Date(Date.now() - 60_000),
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
    };

    expect(isExamAvailableToStudent(exam as any, 'student-1', 'class-2')).toBe(false);
  });

  it('allows a populated class when the student belongs to that class', () => {
    const exam = {
      status: 'published',
      class: { _id: 'class-1', name: 'Class 1' },
      publishDate: new Date(Date.now() - 60_000),
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
    };

    expect(isExamAvailableToStudent(exam as any, 'student-1', 'class-1')).toBe(true);
  });

  it('blocks a published exam before its publish date', () => {
    const exam = {
      status: 'published',
      class: 'class-1',
      publishDate: new Date(Date.now() + 60_000),
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 5 * 60_000),
    };

    expect(isExamAvailableToStudent(exam as any, 'student-1', 'class-1')).toBe(false);
  });

  it('blocks a published exam before its start datetime', () => {
    const exam = {
      status: 'published',
      class: 'class-1',
      startDate: new Date(Date.now() + 60_000),
      endDate: new Date(Date.now() + 5 * 60_000),
    };

    expect(isExamAvailableToStudent(exam as any, 'student-1', 'class-1')).toBe(false);
  });

  it('blocks a published exam after its end datetime', () => {
    const exam = {
      status: 'published',
      class: 'class-1',
      startDate: new Date(Date.now() - 5 * 60_000),
      endDate: new Date(Date.now() - 60_000),
    };

    expect(isExamAvailableToStudent(exam as any, 'student-1', 'class-1')).toBe(false);
  });

  it('uses the earlier of duration and availability end for the deadline', () => {
    const startedAt = new Date('2026-09-25T09:40:00.000Z');
    const availabilityEnd = new Date('2026-09-25T10:00:00.000Z');

    expect(calculateExamDeadline(startedAt, 30, availabilityEnd).toISOString()).toBe('2026-09-25T10:00:00.000Z');
    expect(calculateExamDeadline(startedAt, 10, availabilityEnd).toISOString()).toBe('2026-09-25T09:50:00.000Z');
  });

  it('keeps the original question order when randomization is disabled', () => {
    expect(createQuestionOrder(4, false)).toEqual([0, 1, 2, 3]);
  });

  it('creates a separate randomized order without changing the source order', () => {
    const order = createQuestionOrder(4, true, () => 0);
    expect(order).toEqual([1, 2, 3, 0]);
    expect(createQuestionOrder(4, false)).toEqual([0, 1, 2, 3]);
  });
});
