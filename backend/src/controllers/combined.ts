import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth.ts";
import { logActivity } from "../utils/activitieslog.ts";
import Exam from "../models/exam.ts";
import ExamAttempt from "../models/examAttempt.ts";
import Submission from "../models/submission.ts";
import Announcement from "../models/announcement.ts";
import ReportCard from "../models/reportCard.ts";
import ReportCardRequest from "../models/reportCardRequest.ts";
import Timetable from "../models/timetable.ts";
import User from "../models/user.ts";
import Class from "../models/class.ts";
import Subject from "../models/subject.ts";
import AcademicYear from "../models/academicYear.ts";
import Classwork from "../models/classwork.ts";
import ClassworkSubmission from "../models/classworkSubmission.ts";
import ClassworkGrade from "../models/classworkGrade.ts";
import { removeStoredAttachment } from "../utils/attachments.ts";
import { calculateExamDeadline, createQuestionOrder, isExamAvailableToStudent, normalizeExamQuestions } from "../utils/examAccess.ts";
import { createNotification, createNotifications } from "../utils/notifications.ts";
import { emitAcademicUpdate } from "../realtime.ts";

// ═══════════════════════════════════════════════════════════════════════════
//  EXAM CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════

const requiresAdminApproval = (examType?: string) => {
  if (!examType) return false;
  return ["periodical", "midterm", "finals"].includes(examType);
};

const examScheduleError = (exam: { status?: string; publishDate?: Date; startDate: Date; endDate: Date }) => {
  const now = Date.now();
  if (exam.status !== "published") return "This exam is not available yet.";
  if (exam.publishDate && exam.publishDate.getTime() > now) return "This exam has not been published yet.";
  if (exam.startDate.getTime() > now) return "This exam has not started yet.";
  if (exam.endDate.getTime() < now) return "This exam is no longer available.";
  return null;
};

const validateTeacherExamAccess = async (user: AuthRequest["user"], classId?: string, subjectId?: string) => {
  if (!user) return null;

  if (user.role === "admin") {
    return { classDoc: classId ? await Class.findById(classId) : null, subjectDoc: subjectId ? await Subject.findById(subjectId) : null };
  }

  if (user.role !== "teacher") {
    return null;
  }

  const classDoc = classId ? await Class.findById(classId) : null;
  if (!classDoc) {
    throw new Error("Class not found");
  }

  const classSubjectIds = (classDoc.subjects || []).map((subject) => subject.toString());
  const classAdviserId = classDoc.adviser ? classDoc.adviser.toString() : null;
  const subjectDoc = subjectId ? await Subject.findById(subjectId) : null;

  const isAdviser = classAdviserId === user._id.toString();
  const isAssignedTeachingSubject = Boolean(
    subjectDoc && subjectDoc.teacher && subjectDoc.teacher.toString() === user._id.toString()
  ) || Boolean(
    classSubjectIds.length && (await Subject.exists({ _id: { $in: classSubjectIds }, teacher: user._id, isActive: true }))
  );

  if (!isAdviser && !isAssignedTeachingSubject) {
    throw new Error("You are not assigned to this class or one of its subjects");
  }

  return { classDoc, subjectDoc };
};

export const createExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { class: classId, subject: subjectId, academicYear, status, startDate, endDate } = req.body;

    if (!classId) {
      res.status(400).json({ message: "A class is required to create an exam." });
      return;
    }

    const classDoc = classId ? await Class.findById(classId).lean() : null;
    const defaultAcademicYear = academicYear || classDoc?.academicYear || (await AcademicYear.findOne({ isCurrent: true }))?._id;
    if (!defaultAcademicYear) {
      res.status(400).json({ message: "No academic year is available for this exam." });
      return;
    }

    if (req.user?.role === "teacher") {
      const teacherAccess = await validateTeacherExamAccess(req.user, classId, subjectId);
      if (!teacherAccess) {
        res.status(403).json({ message: "Teacher access denied." });
        return;
      }

      const classDoc = teacherAccess.classDoc as any;
      const subjectDoc = teacherAccess.subjectDoc as any;

      const resolvedSubjectId = subjectId || (subjectDoc?._id ? subjectDoc._id.toString() : undefined) ||
        (Array.isArray(classDoc?.subjects) && classDoc.subjects.length ? classDoc.subjects[0].toString() : undefined);
      if (!resolvedSubjectId) {
        res.status(400).json({ message: "No subject is assigned to this class for your account." });
        return;
      }

      const resolvedAcademicYear = academicYear || classDoc?.academicYear?._id || classDoc?.academicYear || defaultAcademicYear;
      const resolvedPayload = {
        ...req.body,
        class: classDoc._id,
        subject: resolvedSubjectId,
        academicYear: resolvedAcademicYear,
        createdBy: req.user._id,
        status: status || "draft",
      };

      const exam = await Exam.create(resolvedPayload);
      await logActivity({ userId: req.user._id.toString(), action: "CREATE_EXAM", details: `Created exam: ${exam.title}` });
      res.status(201).json(exam);
      return;
    }

    const exam = await Exam.create({ ...req.body, createdBy: req.user!._id });
    await logActivity({ userId: req.user!._id.toString(), action: "CREATE_EXAM", details: `Created exam: ${exam.title}` });
    res.status(201).json(exam);
  } catch (error: any) {
    const message = error?.message || "Server Error";
    const status = message.includes("assigned") || message.includes("Class not found") ? 403 : 500;
    res.status(status).json({ message, error });
  }
};

export const getExams = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const filter: any = {};

    if (req.query.status) filter.status = req.query.status;
    if (req.query.subject) filter.subject = req.query.subject;
    if (req.query.class) filter.class = req.query.class;
    if (req.user?.role === "teacher") filter.createdBy = req.user._id;
    if (req.user?.role === "student") {
      filter.status = "published";
      if (req.user.studentClass) {
        const enrolledRecords = await Class.find({ $or: [{ _id: req.user.studentClass }, { students: req.user._id }] }).select("gradeLevel").lean();
        const yearLevels = [...new Set(enrolledRecords.map((item) => item.gradeLevel).filter(Boolean))];
        if (yearLevels.length) {
          const [yearClasses, yearSubjects] = await Promise.all([
            Class.find({ gradeLevel: { $in: yearLevels } }).distinct("_id"),
            Subject.find({ gradeLevel: { $in: yearLevels } }).distinct("_id"),
          ]);
          filter.$or = [{ class: { $in: yearClasses } }, { subject: { $in: yearSubjects } }];
        } else {
          filter.class = { $in: await Class.find({ students: req.user._id }).distinct("_id") };
        }
      } else {
        filter.class = { $in: await Class.find({ students: req.user._id }).distinct("_id") };
      }
      const submittedExamIds = await Submission.find({ student: req.user._id }).distinct("exam");
      filter._id = { $nin: submittedExamIds };
    }
    if (req.query.search) {
      filter.title = { $regex: req.query.search, $options: "i" };
    }

    const [total, exams] = await Promise.all([
      Exam.countDocuments(filter),
      Exam.find(filter)
        .populate("subject", "name code")
        .populate("class", "name section gradeLevel")
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit),
    ]);

    res.json({ exams, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const startExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate("subject", "name code")
      .populate("class", "name section")
      .populate("createdBy", "name email");
    if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }

    const examClassId = exam.class && typeof exam.class === "object" && "_id" in exam.class
      ? (exam.class as any)._id
      : exam.class;
    const examSubjectId = exam.subject && typeof exam.subject === "object" && "_id" in exam.subject
      ? (exam.subject as any)._id
      : exam.subject;
    const enrolledRecords = await Class.find({ $or: [
      ...(req.user?.studentClass ? [{ _id: req.user.studentClass }] : []),
      { students: req.user!._id },
    ] }).select("gradeLevel").lean();
    const yearLevels = [...new Set(enrolledRecords.map((item) => item.gradeLevel).filter(Boolean))];
    const examSubject = await Subject.findById(examSubjectId).select("gradeLevel").lean();
    const enrolled = yearLevels.length
      ? Boolean(await Class.exists({ _id: examClassId, gradeLevel: { $in: yearLevels } })) || Boolean(examSubject?.gradeLevel && yearLevels.includes(examSubject.gradeLevel))
      : Boolean(await Class.exists({ _id: examClassId, students: req.user!._id }));
    if (!enrolled) { res.status(403).json({ message: "You are not enrolled in this exam's class." }); return; }

    const scheduleError = examScheduleError(exam);
    if (scheduleError) { res.status(403).json({ message: scheduleError }); return; }

    const existingSubmission = await Submission.exists({ exam: exam._id, student: req.user!._id });
    if (existingSubmission) { res.status(409).json({ message: "You have already submitted this exam." }); return; }

    let attempt = await ExamAttempt.findOne({ exam: exam._id, student: req.user!._id });
    const now = new Date();
    if (attempt?.status === "submitted") {
      res.status(409).json({ message: "You have already submitted this exam." });
      return;
    }
    if (attempt && attempt.deadline.getTime() < now.getTime()) {
      attempt.status = "expired";
      await attempt.save();
      res.status(403).json({ message: "Your exam time has expired." });
      return;
    }

    if (!attempt) {
      const questionOrder = createQuestionOrder(exam.questions.length, exam.randomizeQuestions);
      const deadline = calculateExamDeadline(now, exam.duration, exam.endDate);
      attempt = await ExamAttempt.create({
        exam: exam._id,
        student: req.user!._id,
        startedAt: now,
        deadline,
        questionOrder,
      });
    }

    const safeExam = exam.toObject();
    safeExam.questions = attempt.questionOrder
      .map((questionIndex) => safeExam.questions[questionIndex])
      .filter(Boolean)
      .map((question: any) => ({ ...question, correctAnswer: undefined }));
    res.json({
      exam: safeExam,
      serverNow: Date.now(),
      attempt: { _id: attempt._id, startedAt: attempt.startedAt, deadline: attempt.deadline },
    });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const getExamById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate("subject", "name code")
      .populate("class", "name section")
      .populate("createdBy", "name email");
    if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }

    if (req.user?.role === "teacher" && exam.createdBy.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: "You can only access your own exams." });
      return;
    }

    if (req.user?.role === "student") {
      const examClassId = exam.class && typeof exam.class === "object" && "_id" in exam.class
        ? (exam.class as any)._id
        : exam.class;
      const examSubjectId = exam.subject && typeof exam.subject === "object" && "_id" in exam.subject
        ? (exam.subject as any)._id
        : exam.subject;
      const enrolledRecords = await Class.find({ $or: [
        ...(req.user.studentClass ? [{ _id: req.user.studentClass }] : []),
        { students: req.user._id },
      ] }).select("gradeLevel").lean();
      const yearLevels = [...new Set(enrolledRecords.map((item) => item.gradeLevel).filter(Boolean))];
      const examSubject = await Subject.findById(examSubjectId).select("gradeLevel").lean();
      const enrolled = yearLevels.length
        ? Boolean(await Class.exists({ _id: examClassId, gradeLevel: { $in: yearLevels } })) || Boolean(examSubject?.gradeLevel && yearLevels.includes(examSubject.gradeLevel))
        : Boolean(await Class.exists({ _id: examClassId, students: req.user._id }));

      if (!enrolled) {
        res.status(403).json({ message: "You are not enrolled in this exam's class." });
        return;
      }

      const isAvailable = isExamAvailableToStudent(exam.toObject ? exam.toObject() : exam, req.user._id.toString(), String(examClassId));
      if (!isAvailable) {
        const statusMessage = exam.status !== "published"
          ? "This exam is not available yet."
          : exam.publishDate && new Date(exam.publishDate).getTime() > Date.now()
            ? "This exam has not been published yet."
            : "This exam is not currently open.";

        res.status(403).json({ message: statusMessage });
        return;
      }

      const attempt = await ExamAttempt.findOne({ exam: exam._id, student: req.user._id });
      if (!attempt || attempt.status !== "in_progress") {
        res.status(409).json({ message: "Start the exam before accessing its questions." });
        return;
      }
      if (attempt.deadline.getTime() < Date.now()) {
        attempt.status = "expired";
        await attempt.save();
        res.status(403).json({ message: "Your exam time has expired." });
        return;
      }

      const safeExam = exam.toObject();
      safeExam.questions = attempt.questionOrder
        .map((questionIndex) => safeExam.questions[questionIndex])
        .filter(Boolean)
        .map((q: any) => ({ ...q, correctAnswer: undefined }));
      res.json(safeExam);
      return;
    }
    res.json(exam);
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const updateExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }

    if (req.user?.role === "teacher" && exam.createdBy.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: "You can only update your own exams." });
      return;
    }

    if (req.user?.role === "teacher" && req.body.class) {
      const access = await validateTeacherExamAccess(req.user, req.body.class, req.body.subject || exam.subject?.toString());
      if (!access) {
        res.status(403).json({ message: "Teacher access denied." });
        return;
      }
    }

    const editableFields = ["title", "description", "questions", "duration", "timeLimit", "startDate", "endDate", "examType", "passingScore", "allowLateSubmission", "randomizeQuestions", "subject", "class", "academicYear", "status"];
    for (const field of editableFields) {
      if (req.body[field] !== undefined) {
        if (field === "questions") {
          (exam as any)[field] = normalizeExamQuestions(req.body[field]);
        } else {
          (exam as any)[field] = req.body[field];
        }
      }
    }
    const updated = await exam.save();
    await logActivity({ userId: req.user!._id.toString(), action: "UPDATE_EXAM", details: `Updated exam: ${updated.title}` });
    res.json(updated);
  } catch (error: any) {
    res.status(error?.message?.includes("assigned") || error?.message?.includes("Class not found") ? 403 : 500).json({ message: error?.message || "Server Error", error });
  }
};

export const deleteExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }

    if (req.user?.role === "teacher" && exam.createdBy.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: "You can only delete your own exams." });
      return;
    }

    const classworkMatch = {
      class: exam.class,
      subject: exam.subject,
      title: exam.title,
      createdBy: exam.createdBy,
      type: "assessment",
    } as const;
    const mirroredClasswork = await Classwork.findOne({ exam: exam._id }) || await Classwork.findOne(classworkMatch);

    if (mirroredClasswork) {
      await Promise.all(mirroredClasswork.attachments.map((attachment) => removeStoredAttachment(attachment.storagePath)));
      await Promise.all([
        ClassworkSubmission.deleteMany({ classwork: mirroredClasswork._id }),
        ClassworkGrade.deleteMany({ classwork: mirroredClasswork._id }),
        mirroredClasswork.deleteOne(),
      ]);
    }

    await exam.deleteOne();
    await Submission.deleteMany({ exam: req.params.id });
    await logActivity({ userId: req.user!._id.toString(), action: "DELETE_EXAM", details: `Deleted exam: ${exam.title}` });
    emitAcademicUpdate({ classId: exam.class.toString(), kind: "exam" });
    res.json({ message: "Exam deleted" });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const publishExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requestBody = req.body ?? {};
    const exam = await Exam.findById(req.params.id);
    if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }

    if (req.user?.role === "teacher" && exam.createdBy.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: "You can only publish your own exams." });
      return;
    }

    if (req.user?.role === "teacher" && requiresAdminApproval(exam.examType)) {
      res.status(403).json({ message: "Only the admin can publish major exams such as periodicals, midterms, and finals." });
      return;
    }

    const classDoc = await Class.findById(exam.class).lean();
    const classSubjectIds = Array.isArray(classDoc?.subjects) ? classDoc.subjects.map((subject) => String(subject)) : [];
    const fallbackSubjectId = exam.subject ? String(exam.subject) : (classSubjectIds[0] ?? undefined);
    if (!fallbackSubjectId) {
      res.status(400).json({ message: "This class has no subject assigned. Please assign a subject before publishing." });
      return;
    }

    const resolvedAcademicYear = exam.academicYear || classDoc?.academicYear || (await AcademicYear.findOne({ isCurrent: true }))?._id;
    if (!resolvedAcademicYear) {
      res.status(400).json({ message: "No academic year is available for this exam." });
      return;
    }

    const startDate = requestBody.startDate ? new Date(requestBody.startDate) : exam.startDate;
    const endDate = requestBody.endDate ? new Date(requestBody.endDate) : exam.endDate;
    if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      res.status(400).json({ message: "Exam availability dates are required before publishing." });
      return;
    }
    if (exam.duration <= 0 || endDate.getTime() < startDate.getTime()) {
      res.status(400).json({ message: "Exam duration must be greater than 0 and the end date/time must be on or after the start date/time." });
      return;
    }

    if (typeof requestBody.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requestBody.startDate.trim())) {
      startDate.setHours(0, 0, 0, 0);
    }
    if (typeof requestBody.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requestBody.endDate.trim())) {
      endDate.setHours(23, 59, 59, 999);
    }

    const updated = await Exam.findByIdAndUpdate(
      req.params.id,
      {
        status: "published",
        subject: fallbackSubjectId,
        academicYear: resolvedAcademicYear,
        publishDate: requestBody.publishDate || exam.publishDate || new Date(),
        publishTime: requestBody.publishTime || exam.publishTime || "00:00",
        startDate,
        endDate,
        timeLimit: requestBody.timeLimit || exam.timeLimit || exam.duration || 60,
        allowLateSubmission: requestBody.allowLateSubmission ?? exam.allowLateSubmission ?? false,
      },
      { new: true, returnDocument: "after" }
    );

    if (!updated) { res.status(404).json({ message: "Exam not found" }); return; }
    emitAcademicUpdate({ classId: updated.class.toString(), kind: "exam" });

    if (!updated.class || !updated.subject || !updated.academicYear || !updated.createdBy || !updated.title) {
      res.status(400).json({
        message: "This exam is missing required fields for publishing. Please ensure the class, subject, academic year, and creator are set.",
      });
      return;
    }

    if (!Array.isArray(updated.questions) || updated.questions.length === 0) {
      res.status(400).json({ message: "This exam needs at least one question before it can be published." });
      return;
    }

    try {
      const classworkMatch = {
        class: updated.class,
        subject: updated.subject,
        title: updated.title,
        createdBy: updated.createdBy,
        type: "assessment",
      } as const;

      const matchingClasswork = await Classwork.findOne(classworkMatch);
      const dueDateValue = updated.endDate || updated.startDate || new Date();
      const questions = updated.questions.map((question) => ({
        question: question.question,
        type: question.type,
        choices: question.choices || [],
        correctAnswer: question.correctAnswer || "",
        points: Number(question.points || 1),
      }));
      const descriptions = updated.description || "Published assessment.";
      const classworkData = {
        exam: updated._id,
        title: updated.title,
        description: descriptions,
        type: "assessment",
        submissionMode: "response",
        status: "published",
        class: updated.class,
        subject: updated.subject,
        createdBy: updated.createdBy,
        academicYear: updated.academicYear,
        dueDate: dueDateValue,
        dueTime: updated.publishTime || undefined,
        points: Number(updated.totalPoints || 0),
        instructions: descriptions,
        allowLateSubmission: Boolean(updated.allowLateSubmission),
        questions,
        attachments: [],
        publishedAt: new Date(),
      };

      if (matchingClasswork) {
        await Classwork.findByIdAndUpdate(matchingClasswork._id, {
          ...classworkData,
          status: "published",
          dueDate: dueDateValue,
          dueTime: updated.publishTime || undefined,
          points: Number(updated.totalPoints || 0),
          questions,
          description: descriptions,
          instructions: descriptions,
          publishedAt: new Date(),
        }, { new: true, returnDocument: "after" });
      } else {
        await Classwork.create(classworkData);
      }
    } catch (classworkError: any) {
      console.error("Exam publish classwork sync failed:", classworkError);
      res.status(400).json({
        message: classworkError?.message || "The exam could not be published because its classwork sync failed. Check the exam date and class assignment.",
        error: classworkError,
      });
      return;
    }

    try {
      const students = await User.find({ studentClass: updated.class.toString(), role: "student", isActive: true }).select("_id");
      if (students.length) {
        await createNotifications(students.map((student) => student._id), {
          title: "New exam published",
          message: `${updated.title} is now available.`,
          type: "exam",
          relatedResource: updated._id,
        });
      }
    } catch (notificationError) {
      console.error("Exam publish notification failed:", notificationError);
    }

    try {
      await logActivity({ userId: req.user!._id.toString(), action: "PUBLISH_EXAM", details: `Published exam: ${updated.title}` });
    } catch (activityError) {
      console.error("Exam publish activity log failed:", activityError);
    }

    res.json(updated);
  } catch (error: any) {
    const message = error?.message || "Server Error";
    const status = message.includes("Cast to ObjectId") || message.includes("not found") ? 404 : 500;
    res.status(status).json({ message, error });
  }
};

export const closeExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }

    if (req.user?.role === "teacher" && exam.createdBy.toString() !== req.user._id.toString()) {
      res.status(403).json({ message: "You can only close your own exams." });
      return;
    }

    if (req.user?.role === "teacher" && requiresAdminApproval(exam.examType)) {
      res.status(403).json({ message: "Only the admin can close major exams such as periodicals, midterms, and finals." });
      return;
    }

    const updated = await Exam.findByIdAndUpdate(req.params.id, { status: "closed" }, { new: true });
    if (updated) {
      const matchingClasswork = await Classwork.findOne({
        class: updated.class,
        subject: updated.subject,
        title: updated.title,
        createdBy: updated.createdBy,
        type: "assessment",
      });
      if (matchingClasswork) {
        await Classwork.findByIdAndUpdate(matchingClasswork._id, {
          status: "closed",
          closedAt: new Date(),
        });
      }
    }
    res.json(updated);
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

// ═══════════════════════════════════════════════════════════════════════════
//  SUBMISSION CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════

export const submitExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { examId, attemptId, answers, timeSpent } = req.body;
    const exam = await Exam.findById(examId);
    if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }

    if (!attemptId || !Array.isArray(answers)) {
      res.status(400).json({ message: "A valid exam attempt and answers are required." });
      return;
    }

    const enrolled = await Class.exists({ _id: exam.class, students: req.user!._id });
    if (!enrolled) {
      res.status(403).json({ message: "You are not enrolled in this exam's class." });
      return;
    }

    if (exam.status !== "published") {
      res.status(403).json({ message: "This exam is not open for submission." });
      return;
    }

    const attempt = await ExamAttempt.findOne({ _id: attemptId, exam: examId, student: req.user!._id });
    if (!attempt || attempt.status !== "in_progress") {
      res.status(403).json({ message: "This exam attempt is no longer active." });
      return;
    }

    const now = new Date();
    if (now.getTime() > attempt.deadline.getTime() || now.getTime() > exam.endDate.getTime()) {
      attempt.status = "expired";
      await attempt.save();
      res.status(403).json({ message: "Your exam time has expired." });
      return;
    }

    const existing = await Submission.findOne({ exam: examId, student: req.user!._id });
    if (existing) { res.status(400).json({ message: "Already submitted" }); return; }

    let score = 0;
    const gradedAnswers = answers.map((a: any) => {
      const originalQuestionIndex = attempt.questionOrder[a.questionIndex];
      if (originalQuestionIndex === undefined) return a;
      const question = exam.questions[originalQuestionIndex];
      if (!question) return a;
      if (question.type !== "essay") {
        const isCorrect = a.answer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
        if (isCorrect) score += question.points;
        return { ...a, isCorrect, pointsEarned: isCorrect ? question.points : 0 };
      }
      return { ...a, isCorrect: null, pointsEarned: 0 };
    });

    const requiresReview = exam.questions.some((question) => question.type === "essay" || question.type === "short_answer");
    const percentage = exam.totalPoints > 0 ? Math.round((score / exam.totalPoints) * 100) : 0;
    const submission = await Submission.create({
      exam: examId, student: req.user!._id,
      answers: gradedAnswers.map((answer: any) => ({
        ...answer,
        questionIndex: attempt!.questionOrder[answer.questionIndex] ?? answer.questionIndex,
      })), score,
      totalPoints: exam.totalPoints,
      percentage, isPassed: !requiresReview && percentage >= exam.passingScore,
      status: requiresReview ? "pending" : "graded", timeSpent,
      attempt: attempt._id,
      startedAt: attempt.startedAt,
      deadline: attempt.deadline,
      questionOrder: attempt.questionOrder,
    });

    attempt.status = "submitted";
    attempt.submittedAt = now;
    await attempt.save();

    await logActivity({ userId: req.user!._id.toString(), action: "SUBMIT_EXAM", details: `Submitted exam: ${exam.title} with score ${score}/${exam.totalPoints}` });
    await createNotification({
      recipient: exam.createdBy,
      title: "Evaluation submitted",
      message: `${req.user!.name} submitted ${exam.title}.`,
      type: "submission",
      relatedResource: submission._id,
    });
    res.status(201).json(submission);
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const getSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    if (req.query.exam) filter.exam = req.query.exam;
    if (req.query.student) filter.student = req.query.student;

    const submissions = await Submission.find(filter)
      .populate("student", "name email")
      .populate("exam", "title examType totalPoints passingScore")
      .sort({ submittedAt: -1 });

    res.json({ submissions });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const getMySubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const enrolledClasses = await Class.find({
      isActive: true,
      $or: [{ students: req.user!._id }, { _id: req.user?.studentClass }],
    }).select("subjects").lean();
    const currentSubjectIds = [...new Set(enrolledClasses.flatMap((classDoc) => (classDoc.subjects || []).map((subject) => String(subject))))];
    const submissions = await Submission.find({ student: req.user!._id })
      .populate({
        path: "exam",
        select: "title examType totalPoints passingScore subject class",
        populate: [
          { path: "subject", select: "name code gradeLevel" },
          { path: "class", select: "gradeLevel" },
        ],
      })
      .sort({ submittedAt: -1 });
    const visibleSubmissions = enrolledClasses.length
      ? submissions.filter((submission: any) => currentSubjectIds.includes(String(submission.exam?.subject?._id || submission.exam?.subject)))
      : submissions;
    res.json({ submissions: visibleSubmissions });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const gradeSubmission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { answers, feedback, score } = req.body;
    const submission = await Submission.findById(req.params.id);
    if (!submission) { res.status(404).json({ message: "Submission not found" }); return; }
    const exam = await Exam.findById(submission.exam);
    if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }
    if (req.user?.role !== "admin" && exam.createdBy.toString() !== req.user!._id.toString()) {
      res.status(403).json({ message: "You can only grade submissions for your own exams." });
      return;
    }
    if (answers) submission.answers = answers;
    if (feedback) submission.feedback = feedback;
    if (score !== undefined) {
      submission.score = score;
      submission.totalPoints = exam.totalPoints;
      submission.percentage = Math.round((score / exam.totalPoints) * 100);
      submission.isPassed = submission.percentage >= exam.passingScore;
    }
    submission.status = "graded";
    submission.gradedAt = new Date();
    submission.gradedBy = req.user!._id as any;
    await submission.save();
    await createNotification({
      recipient: submission.student,
      title: "Submission graded",
      message: "Your submission has been graded.",
      type: "submission",
      relatedResource: submission._id,
    });
    res.json(submission);
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

// ═══════════════════════════════════════════════════════════════════════════
//  ANNOUNCEMENT CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════

export const createAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { targetClass, targetRole, targetUsers = [] } = req.body;
    const announcementTargetUsers = req.user?.role === "admin" ? targetUsers : [];

    if (announcementTargetUsers.length > 0) {
      const validRecipients = await User.countDocuments({ _id: { $in: announcementTargetUsers }, isActive: true });
      if (validRecipients !== announcementTargetUsers.length) {
        res.status(400).json({ message: "One or more selected recipients are invalid or inactive." });
        return;
      }
    }

    if (req.user?.role === "teacher") {
      if (!targetClass) {
        res.status(400).json({ message: "Please select the class for this announcement." });
        return;
      }

      const targetClassDoc = await Class.findById(targetClass);
      if (!targetClassDoc) {
        res.status(404).json({ message: "Class not found." });
        return;
      }

      if (targetClassDoc.adviser?.toString() !== req.user._id.toString()) {
        res.status(403).json({ message: "You are not authorized to manage this class." });
        return;
      }
    }

    const ann = await Announcement.create({ ...req.body, author: req.user!._id, targetRole: targetRole || "all", targetUsers: announcementTargetUsers });

    const recipientFilter: any = { isActive: true, _id: { $ne: req.user!._id } };
    if (ann.targetUsers?.length) {
      const recipients = await User.find({ _id: { $in: ann.targetUsers, $ne: req.user!._id }, isActive: true }).select("_id");
      await createNotifications(recipients.map((recipient) => recipient._id), {
        title: "New announcement",
        message: ann.title,
        type: "announcement",
        relatedResource: ann._id,
      });
    } else if (ann.targetClass) {
      const classStudents = await User.find({ role: "student", studentClass: ann.targetClass.toString(), isActive: true }).select("_id");
      const recipients = classStudents.map((student) => student._id);
      if (recipients.length) {
        await createNotifications(recipients, {
          title: "New class announcement",
          message: ann.title,
          type: "announcement",
          relatedResource: ann._id,
        });
      }
    } else if (ann.targetRole !== "all") {
      recipientFilter.role = ann.targetRole;
      const recipients = await User.find(recipientFilter).select("_id");
      await createNotifications(recipients.map((recipient) => recipient._id), {
        title: "New announcement",
        message: ann.title,
        type: "announcement",
        relatedResource: ann._id,
      });
    } else {
      const recipients = await User.find(recipientFilter).select("_id");
      await createNotifications(recipients.map((recipient) => recipient._id), {
        title: "New announcement",
        message: ann.title,
        type: "announcement",
        relatedResource: ann._id,
      });
    }

    await logActivity({ userId: req.user!._id.toString(), action: "CREATE_ANNOUNCEMENT", details: `Created: ${ann.title}` });
    res.status(201).json(ann);
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const getAnnouncements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const filter: any = { isActive: true };

    if (req.user?.role === "student") {
      const enrolledClassIds = await Class.find({
        isActive: true,
        $or: [{ students: req.user._id }, { _id: req.user.studentClass }],
      }).distinct("_id");
      filter.$or = [
        { targetUsers: req.user._id },
        { targetClass: { $exists: false }, targetRole: { $in: ["all", "student"] } },
        { targetClass: null, targetRole: { $in: ["all", "student"] } },
        { targetClass: { $in: enrolledClassIds } },
      ];
    } else if (req.user?.role === "teacher") {
      const teacherSubjectIds = await Subject.find({ teacher: req.user._id, isActive: true }).distinct("_id");
      const teacherClassIds = await Class.find({
        $or: [{ adviser: req.user._id }, { subjects: { $in: teacherSubjectIds } }],
      }).distinct("_id");
      filter.$or = [
        { targetUsers: req.user._id },
        { targetClass: { $exists: false }, targetRole: { $in: ["all", "teacher"] } },
        { targetClass: null, targetRole: { $in: ["all", "teacher"] } },
        { targetClass: { $in: teacherClassIds } },
      ];
    } else if (req.user?.role && req.user.role !== "admin") {
      filter.$or = [{ targetUsers: req.user._id }, { targetRole: "all" }, { targetRole: req.user.role }];
    }

    filter.$and = [{
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    }];

    const announcements = await Announcement.find(filter)
      .populate("author", "name role")
      .populate("targetClass", "name section gradeLevel")
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(limit);
    res.json({ announcements });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const updateAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ann = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!ann) { res.status(404).json({ message: "Announcement not found" }); return; }
    res.json(ann);
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

// ═══════════════════════════════════════════════════════════════════════════
//  DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════════════

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const currentAcademicYear = await AcademicYear.findOne({ isCurrent: true }).lean();
    const academicYearStart = currentAcademicYear?.startDate || new Date(now.getFullYear() - (now.getMonth() < 7 ? 1 : 0), 7, 1);
    const academicYearEnd = currentAcademicYear?.endDate || new Date(now.getFullYear() + (now.getMonth() >= 7 ? 1 : 0), 6, 30, 23, 59, 59, 999);
    const academicYearFilter = currentAcademicYear ? { academicYear: currentAcademicYear._id } : {};
    const performanceEnd = now < academicYearEnd ? now : academicYearEnd;
    const studentFilter = { role: "student", isActive: true } as const;

    const [totalStudents, totalTeachers, totalClasses, totalSubjects, activeExams, pendingSubmissions, studentsByGrade, studentsBeforeYear, studentEnrollments, performanceBuckets] = await Promise.all([
      User.countDocuments(studentFilter),
      User.countDocuments({ role: "teacher", isActive: true }),
      Class.countDocuments({ isActive: true, ...academicYearFilter }),
      Subject.countDocuments({ isActive: true, ...academicYearFilter }),
      Exam.countDocuments({ status: "published", ...academicYearFilter }),
      Submission.countDocuments({ status: "submitted" }),
      User.aggregate([
        { $match: studentFilter },
        { $lookup: { from: "classes", localField: "_id", foreignField: "students", as: "classDoc" } },
        { $unwind: "$classDoc" },
        { $match: { "classDoc.isActive": true, ...Object.fromEntries(Object.entries(academicYearFilter).map(([key, value]) => [`classDoc.${key}`, value])) } },
        { $group: { _id: "$_id", grade: { $first: "$classDoc.gradeLevel" } } },
        { $group: { _id: "$grade", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      User.countDocuments({ ...studentFilter, createdAt: { $lt: academicYearStart } }),
      User.aggregate([
        { $match: { ...studentFilter, createdAt: { $gte: academicYearStart, $lte: performanceEnd } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } },
      ]),
      Submission.aggregate([
        { $match: { status: "graded", createdAt: { $gte: academicYearStart, $lte: performanceEnd }, percentage: { $gte: 0, $lte: 100 } } },
        { $bucket: {
          groupBy: "$percentage",
          boundaries: [0, 70, 80, 90, 101],
          default: "unknown",
          output: { count: { $sum: 1 } },
        } },
      ]),
    ]);

    const enrollmentCounts = new Map((studentEnrollments as Array<{ _id: string; count: number }>).map((item) => [item._id, item.count]));
    const enrollmentTrend: Array<{ month: string; students: number }> = [];
    let enrolledStudents = studentsBeforeYear;
    const cursor = new Date(academicYearStart.getFullYear(), academicYearStart.getMonth(), 1);
    while (cursor <= performanceEnd && cursor <= academicYearEnd) {
      const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      enrolledStudents += enrollmentCounts.get(monthKey) || 0;
      enrollmentTrend.push({
        month: cursor.toLocaleString("en-US", { month: "short" }),
        students: enrolledStudents,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const performanceLabels = ["Needs Work (<70)", "Satisfactory (70-79)", "Good (80-89)", "Excellent (90-100)"];
    const performanceBoundaries = [0, 70, 80, 90];
    const performanceCounts = new Map((performanceBuckets as Array<{ _id: number; count: number }>).map((item) => [item._id, item.count]));
    const performanceTotal = performanceBoundaries.reduce((total, boundary) => total + (performanceCounts.get(boundary) || 0), 0);
    const performanceDistribution = performanceLabels.map((name, index) => {
      const boundary = performanceBoundaries[index] ?? 0;
      const count = performanceCounts.get(boundary) || 0;
      return { name, count, percentage: performanceTotal ? Math.round((count / performanceTotal) * 1000) / 10 : 0 };
    });

    res.json({
      totalStudents, totalTeachers, totalClasses, totalSubjects, activeExams, pendingSubmissions,
      enrollmentTrend,
      studentsByGrade: studentsByGrade.map((item: { _id: string; count: number }) => ({ grade: item._id, count: item.count })),
      performanceDistribution,
    });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

// ═══════════════════════════════════════════════════════════════════════════
//  TIMETABLE
// ═══════════════════════════════════════════════════════════════════════════

export const getTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role === "student") {
      const enrolled = await Class.exists({ _id: req.params.classId, $or: [{ students: req.user._id }, { _id: req.user.studentClass }] });
      if (!enrolled) { res.status(403).json({ message: "You are not enrolled in this class." }); return; }
    }
    const timetable = await Timetable.findOne({ class: req.params.classId })
      .populate("timeSlots.subject", "name code")
      .populate("timeSlots.teacher", "name");
    res.json(timetable || { timeSlots: [] });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const createOrUpdateTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const timeToMinutes = (time: string) => {
      const [hours, minutes] = String(time).split(":").map(Number);
      if (hours === undefined || minutes === undefined) return Number.NaN;
      return hours * 60 + minutes;
    };
    const invalidSlot = (slot: { startTime?: string; endTime?: string }) => {
      const start = timeToMinutes(slot.startTime || "");
      const end = timeToMinutes(slot.endTime || "");
      return !Number.isFinite(start) || !Number.isFinite(end) || start % 15 !== 0 || end % 15 !== 0 || end <= start;
    };
    if (!Array.isArray(req.body.timeSlots) || req.body.timeSlots.some(invalidSlot)) {
      res.status(400).json({ message: "Timetable times must use 15-minute intervals, with the end time after the start time." });
      return;
    }
    const existing = await Timetable.findOne({ class: req.body.class });
    if (existing) {
      Object.assign(existing, req.body);
      const updated = await existing.save();
      res.json(updated);
    } else {
      const timetable = await Timetable.create({ ...req.body, createdBy: req.user!._id });
      res.status(201).json(timetable);
    }
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

// ═══════════════════════════════════════════════════════════════════════════
//  REPORT CARDS
// ═══════════════════════════════════════════════════════════════════════════

export const generateReportCard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== "admin") {
      res.status(403).json({ message: "Only administrators can generate report cards." });
      return;
    }

    const { studentId, classId, academicYearId, period, attendance, requestId } = req.body;

    const submissions = await Submission.find({ student: studentId, status: "graded" }).populate("exam");

    const subjectMap: Record<string, number[]> = {};
    for (const sub of submissions) {
      const exam = sub.exam as any;
      if (!exam?.subject) continue;
      const subjectId = exam.subject.toString();
      if (!subjectMap[subjectId]) subjectMap[subjectId] = [];
      subjectMap[subjectId].push(sub.percentage);
    }

    const subjects = await Subject.find({ _id: { $in: Object.keys(subjectMap) } });
    const subjectGrades = subjects.map((sub) => {
      const scores = subjectMap[sub._id.toString()] || [];
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return {
        subject: sub._id,
        subjectName: sub.name,
        q1: avg,
        q2: avg,
        q3: avg,
        q4: avg,
        finalGrade: avg,
        remarks: avg >= 75 ? "Passed" : "Failed",
      };
    });

    const generalAverage = subjectGrades.length
      ? Math.round(subjectGrades.reduce((a, s) => a + s.finalGrade, 0) / subjectGrades.length)
      : 0;

    const reportCard = await ReportCard.create({
      student: studentId,
      class: classId,
      academicYear: academicYearId,
      period,
      subjectGrades,
      generalAverage,
      overallRemarks: generalAverage >= 75 ? "Promoted" : "For Review",
      attendance: attendance || { totalDays: 0, presentDays: 0, absentDays: 0, tardyDays: 0 },
      generatedBy: req.user!._id,
    });

    if (requestId) {
      const request = await ReportCardRequest.findById(requestId);
      if (request) {
        request.reportCard = reportCard._id;
        request.status = "generated";
        request.generatedBy = req.user!._id;
        request.generatedAt = new Date();
        await request.save();
      }
    }

    await logActivity({
      userId: req.user!._id.toString(),
      action: "GENERATE_REPORT_CARD",
      details: `Generated a report card for student ${studentId}`,
    });
    res.status(201).json(reportCard);
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const createReportCardRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== "teacher") {
      res.status(403).json({ message: "Only teachers can request report cards." });
      return;
    }

    const { studentId, period, classId, academicYearId } = req.body;
    if (!studentId || !studentId.trim()) {
      res.status(400).json({ message: "Please select a student." });
      return;
    }

    const student = await User.findById(studentId);
    if (!student || student.role !== "student") {
      res.status(404).json({ message: "Student not found." });
      return;
    }

    let resolvedClassId = classId || student.studentClass || undefined;
    if (!resolvedClassId) {
      const classMembership = await Class.findOne({ students: student._id });
      resolvedClassId = classMembership?._id?.toString();
    }

    const request = await ReportCardRequest.create({
      teacher: req.user._id,
      student: student._id,
      class: resolvedClassId,
      academicYear: academicYearId || (resolvedClassId ? (await Class.findById(resolvedClassId))?.academicYear : undefined),
      period: period || "Final",
      status: "pending",
      requestedAt: new Date(),
    });

    await logActivity({
      userId: req.user._id.toString(),
      action: "REQUEST_REPORT_CARD",
      details: `Requested a report card for ${student.name}`,
    });

    res.status(201).json(request);
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const getReportCardRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    if (req.user?.role === "teacher") {
      filter.teacher = req.user._id;
    }

    const requests = await ReportCardRequest.find(filter)
      .populate("teacher", "name email role")
      .populate("student", "name email")
      .populate("class", "name section gradeLevel")
      .populate("academicYear", "name")
      .populate("reportCard")
      .sort({ requestedAt: -1 });

    res.json({ requests });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const sendReportCardRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== "admin") {
      res.status(403).json({ message: "Only administrators can send report cards." });
      return;
    }

    const { reportCardId } = req.body;
    const request = await ReportCardRequest.findById(req.params.id);
    if (!request) {
      res.status(404).json({ message: "Report card request not found." });
      return;
    }

    const reportCard = await ReportCard.findById(reportCardId || request.reportCard);
    if (!reportCard) {
      res.status(404).json({ message: "Report card not found." });
      return;
    }

    request.reportCard = reportCard._id;
    request.status = "sent";
    request.sentToTeacher = request.teacher;
    request.sentAt = new Date();
    request.generatedBy = req.user._id;
    request.generatedAt = request.generatedAt || new Date();
    await request.save();

    await logActivity({
      userId: req.user._id.toString(),
      action: "SEND_REPORT_CARD",
      details: `Sent a report card to ${request.teacher}`,
    });

    res.json(request);
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const getStudentReportCards = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: any = { student: req.params.studentId };
    if (req.query.academicYearId) filter.academicYear = req.query.academicYearId;
    const cards = await ReportCard.find(filter)
      .populate("student", "name email")
      .populate("class", "name section gradeLevel")
      .populate("academicYear", "name")
      .sort({ createdAt: -1 });
    res.json({ reportCards: cards });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const getAllReportCards = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const filter: any = {};

    if (req.user?.role === "teacher") {
      const teacherRequests = await ReportCardRequest.find({ teacher: req.user._id, reportCard: { $exists: true, $ne: null } }).select("reportCard");
      const ids = teacherRequests.map((item) => item.reportCard).filter(Boolean);
      filter._id = { $in: ids };
    }

    if (req.query.academicYear) filter.academicYear = req.query.academicYear;
    if (req.query.class) filter.class = req.query.class;

    const [total, cards] = await Promise.all([
      ReportCard.countDocuments(filter),
      ReportCard.find(filter)
        .populate("student", "name email")
        .populate("class", "name section")
        .populate("academicYear", "name")
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);
    res.json({ reportCards: cards, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

// ═══════════════════════════════════════════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

export const getAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const period = (req.query.period as string) || 'year';

    // Build date range
    const now = new Date();
    let startDate: Date;
    if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), q * 3, 1);
    } else {
      // Current school year: starts Aug 1
      const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
      startDate = new Date(year, 7, 1);
    }

    // Core counts are calculated from the current database state.
    const [
      totalUsers, totalStudents, totalTeachers, totalAdmins, totalExams,
      gradedSubmissions, allSubmissions,
      pendingSubmissions, examTypeCounts, classCounts,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: 'student', isActive: true }),
      User.countDocuments({ role: 'teacher', isActive: true }),
      User.countDocuments({ role: 'admin', isActive: true }),
      Exam.countDocuments({ createdAt: { $gte: startDate } }),
      Submission.countDocuments({ status: 'graded', createdAt: { $gte: startDate } }),
      Submission.countDocuments({ createdAt: { $gte: startDate } }),
      Submission.countDocuments({ status: { $in: ['pending', 'submitted'] }, createdAt: { $gte: startDate } }),
      // exam type distribution
      Exam.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$examType', count: { $sum: 1 } } },
      ]),
      // students by grade via classes
      Class.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$gradeLevel', students: { $sum: { $size: { $ifNull: ['$students', []] } } } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Pass rate & avg score from graded submissions
    const scoreStats = await Submission.aggregate([
      { $match: { status: 'graded', createdAt: { $gte: startDate } } },
      { $group: {
        _id: null,
        avgScore: { $avg: '$percentage' },
        passedCount: { $sum: { $cond: ['$isPassed', 1, 0] } },
        total: { $sum: 1 },
      }},
    ]);

    const avgScore    = scoreStats[0]?.avgScore    ?? 0;
    const passRate    = scoreStats[0] ? (scoreStats[0].passedCount / scoreStats[0].total) * 100 : 0;

    // Monthly activity for the selected period, using submission timestamps.
    const months: { month: string; submissions: number; passed: number }[] = [];
    const monthCount = period === 'month' ? 1 : period === 'quarter' ? 3 : 12;
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const [subs, passed] = await Promise.all([
        Submission.countDocuments({ createdAt: { $gte: d, $lt: next } }),
        Submission.countDocuments({ status: 'graded', isPassed: true, createdAt: { $gte: d, $lt: next } }),
      ]);
      months.push({
        month: d.toLocaleString('en-US', { month: 'short' }),
        submissions: subs,
        passed,
      });
    }

    // Score distribution (graded submissions)
    const scoreRanges = [
      { range: '95-100', min: 95, max: 101 },
      { range: '90-94',  min: 90, max: 95  },
      { range: '85-89',  min: 85, max: 90  },
      { range: '80-84',  min: 80, max: 85  },
      { range: '75-79',  min: 75, max: 80  },
      { range: '70-74',  min: 70, max: 75  },
      { range: '<70',    min: 0,  max: 70  },
    ];
    const scoreDist = await Promise.all(
      scoreRanges.map(async (r) => ({
        range: r.range,
        count: await Submission.countDocuments({
          status: 'graded',
          createdAt: { $gte: startDate },
          percentage: { $gte: r.min, $lt: r.max },
        }),
      }))
    );

    // Subject performance
    const subjectPerf = await Submission.aggregate([
      { $match: { status: 'graded', createdAt: { $gte: startDate } } },
      { $lookup: { from: 'exams', localField: 'exam', foreignField: '_id', as: 'examData' } },
      { $unwind: '$examData' },
      { $lookup: { from: 'subjects', localField: 'examData.subject', foreignField: '_id', as: 'subjectData' } },
      { $unwind: { path: '$subjectData', preserveNullAndEmptyArrays: true } },
      { $group: {
        _id: '$subjectData._id',
        subject: { $first: '$subjectData.name' },
        avgScore: { $avg: '$percentage' },
        passedCount: { $sum: { $cond: ['$isPassed', 1, 0] } },
        total: { $sum: 1 },
      }},
      { $project: {
        subject: 1,
        avg: { $round: ['$avgScore', 1] },
        passed: { $round: [{ $multiply: [{ $divide: ['$passedCount', '$total'] }, 100] }, 1] },
      }},
      { $limit: 8 },
    ]);

    // Enrollment trend (by class active status / academic year)
    const enrollTrend = await User.aggregate([
      { $match: { role: 'student', isActive: true, createdAt: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } },
      { $limit: 12 },
    ]);

    res.json({
      summary: {
        totalUsers,
        totalStudents,
        totalTeachers,
        totalAdmins,
        totalExams,
        passRate: Math.round(passRate * 10) / 10,
        avgScore: Math.round(avgScore * 10) / 10,
        totalSubmissions: allSubmissions,
        gradedSubmissions,
        submittedEvaluations: allSubmissions,
        pendingEvaluations: pendingSubmissions,
        completedEvaluations: gradedSubmissions,
      },
      monthlyActivity: months,
      examTypeDist: examTypeCounts.map((e: any) => ({
        name: e._id.charAt(0).toUpperCase() + e._id.slice(1),
        value: e.count,
      })),
      scoreDist,
      subjectPerf,
      studentsByGrade: classCounts.map((c: any) => ({ grade: c._id, students: c.students })),
      enrollTrend: enrollTrend.map((e: any) => ({ month: e._id, students: e.count })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};
