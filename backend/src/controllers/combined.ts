import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth";
import { logActivity } from "../utils/activitieslog";
import Exam from "../models/exam";
import Submission from "../models/submission";
import Announcement from "../models/announcement";
import ReportCard from "../models/reportCard";
import Timetable from "../models/timetable";
import User from "../models/user";
import Class from "../models/class";
import Subject from "../models/subject";

// ═══════════════════════════════════════════════════════════════════════════
//  EXAM CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════

export const createExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exam = await Exam.create({ ...req.body, createdBy: req.user!._id });
    await logActivity({ userId: req.user!._id.toString(), action: "CREATE_EXAM", details: `Created exam: ${exam.title}` });
    res.status(201).json(exam);
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
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
      if (req.user.studentClass) filter.class = req.user.studentClass;
    }
    if (req.query.search) {
      filter.title = { $regex: req.query.search, $options: "i" };
    }

    const [total, exams] = await Promise.all([
      Exam.countDocuments(filter),
      Exam.find(filter)
        .populate("subject", "name code")
        .populate("class", "name section")
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit),
    ]);

    res.json({ exams, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const getExamById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate("subject", "name code")
      .populate("class", "name section")
      .populate("createdBy", "name email");
    if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }
    // Students don't see correct answers
    if (req.user?.role === "student") {
      const safeExam = exam.toObject();
      safeExam.questions = safeExam.questions.map((q: any) => ({ ...q, correctAnswer: undefined }));
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
    Object.assign(exam, req.body);
    const updated = await exam.save();
    await logActivity({ userId: req.user!._id.toString(), action: "UPDATE_EXAM", details: `Updated exam: ${updated.title}` });
    res.json(updated);
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const deleteExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }
    await exam.deleteOne();
    await Submission.deleteMany({ exam: req.params.id });
    await logActivity({ userId: req.user!._id.toString(), action: "DELETE_EXAM", details: `Deleted exam: ${exam.title}` });
    res.json({ message: "Exam deleted" });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const publishExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, { status: "published" }, { new: true });
    if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }
    await logActivity({ userId: req.user!._id.toString(), action: "PUBLISH_EXAM", details: `Published exam: ${exam.title}` });
    res.json(exam);
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const closeExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, { status: "closed" }, { new: true });
    if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }
    res.json(exam);
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

// ═══════════════════════════════════════════════════════════════════════════
//  SUBMISSION CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════

export const submitExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { examId, answers, timeSpent } = req.body;
    const exam = await Exam.findById(examId);
    if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }

    // Check if already submitted
    const existing = await Submission.findOne({ exam: examId, student: req.user!._id });
    if (existing) { res.status(400).json({ message: "Already submitted" }); return; }

    // Auto-grade non-essay questions
    let score = 0;
    const gradedAnswers = answers.map((a: any) => {
      const question = exam.questions[a.questionIndex];
      if (!question) return a;
      if (question.type !== "essay") {
        const isCorrect = a.answer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
        if (isCorrect) score += question.points;
        return { ...a, isCorrect, pointsEarned: isCorrect ? question.points : 0 };
      }
      return { ...a, isCorrect: null, pointsEarned: 0 };
    });

    const percentage = exam.totalPoints > 0 ? Math.round((score / exam.totalPoints) * 100) : 0;
    const submission = await Submission.create({
      exam: examId, student: req.user!._id,
      answers: gradedAnswers, score,
      totalPoints: exam.totalPoints,
      percentage, isPassed: percentage >= exam.passingScore,
      status: "graded", timeSpent,
    });

    await logActivity({ userId: req.user!._id.toString(), action: "SUBMIT_EXAM", details: `Submitted exam: ${exam.title} with score ${score}/${exam.totalPoints}` });
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
    const submissions = await Submission.find({ student: req.user!._id })
      .populate("exam", "title examType totalPoints passingScore subject")
      .sort({ submittedAt: -1 });
    res.json({ submissions });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const gradeSubmission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { answers, feedback, score } = req.body;
    const submission = await Submission.findById(req.params.id);
    if (!submission) { res.status(404).json({ message: "Submission not found" }); return; }
    if (answers) submission.answers = answers;
    if (feedback) submission.feedback = feedback;
    if (score !== undefined) {
      submission.score = score;
      const exam = await Exam.findById(submission.exam);
      if (exam) {
        submission.totalPoints = exam.totalPoints;
        submission.percentage = Math.round((score / exam.totalPoints) * 100);
        submission.isPassed = submission.percentage >= exam.passingScore;
      }
    }
    submission.status = "graded";
    submission.gradedAt = new Date();
    submission.gradedBy = req.user!._id as any;
    await submission.save();
    res.json(submission);
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

// ═══════════════════════════════════════════════════════════════════════════
//  ANNOUNCEMENT CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════

export const createAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ann = await Announcement.create({ ...req.body, author: req.user!._id });
    await logActivity({ userId: req.user!._id.toString(), action: "CREATE_ANNOUNCEMENT", details: `Created: ${ann.title}` });
    res.status(201).json(ann);
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const getAnnouncements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const filter: any = { isActive: true };
    if (req.user?.role && req.user.role !== "admin") {
      filter.$or = [{ targetRole: "all" }, { targetRole: req.user.role }];
    }
    const announcements = await Announcement.find(filter)
      .populate("author", "name role")
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
    const [totalStudents, totalTeachers, totalClasses, totalSubjects, activeExams, pendingSubmissions] = await Promise.all([
      User.countDocuments({ role: "student", isActive: true }),
      User.countDocuments({ role: "teacher", isActive: true }),
      Class.countDocuments({ isActive: true }),
      Subject.countDocuments({ isActive: true }),
      Exam.countDocuments({ status: "published" }),
      Submission.countDocuments({ status: "submitted" }),
    ]);
    res.json({ totalStudents, totalTeachers, totalClasses, totalSubjects, activeExams, pendingSubmissions });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

// ═══════════════════════════════════════════════════════════════════════════
//  TIMETABLE
// ═══════════════════════════════════════════════════════════════════════════

export const getTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const timetable = await Timetable.findOne({ class: req.params.classId })
      .populate("timeSlots.subject", "name code")
      .populate("timeSlots.teacher", "name");
    res.json(timetable || { timeSlots: [] });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const createOrUpdateTimetable = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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
    const { studentId, classId, academicYearId, period, attendance } = req.body;

    // Get all submissions for this student
    const submissions = await Submission.find({ student: studentId, status: "graded" })
      .populate("exam");

    // Group by subject
    const subjectMap: Record<string, number[]> = {};
    for (const sub of submissions) {
      const exam = sub.exam as any;
      if (!exam?.subject) continue;
      const subjectId = exam.subject.toString();
      if (!subjectMap[subjectId]) subjectMap[subjectId] = [];
      subjectMap[subjectId].push(sub.percentage);
    }

    // Build grade per subject
    const subjects = await Subject.find({ _id: { $in: Object.keys(subjectMap) } });
    const subjectGrades = subjects.map(sub => {
      const scores = subjectMap[sub._id.toString()] || [];
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return {
        subject: sub._id, subjectName: sub.name,
        q1: avg, q2: avg, q3: avg, q4: avg,
        finalGrade: avg,
        remarks: avg >= 75 ? "Passed" : "Failed",
      };
    });

    const generalAverage = subjectGrades.length
      ? Math.round(subjectGrades.reduce((a, s) => a + s.finalGrade, 0) / subjectGrades.length)
      : 0;

    const reportCard = await ReportCard.create({
      student: studentId, class: classId,
      academicYear: academicYearId, period,
      subjectGrades, generalAverage,
      overallRemarks: generalAverage >= 75 ? "Promoted" : "For Review",
      attendance: attendance || { totalDays: 0, presentDays: 0, absentDays: 0, tardyDays: 0 },
      generatedBy: req.user!._id,
    });

    await logActivity({ userId: req.user!._id.toString(), action: "GENERATE_REPORT_CARD", details: `Generated report card for student ${studentId}` });
    res.status(201).json(reportCard);
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

    // Core counts
    const [
      totalStudents, totalExams,
      gradedSubmissions, allSubmissions,
      examTypeCounts, classCounts,
    ] = await Promise.all([
      User.countDocuments({ role: 'student', isActive: true }),
      Exam.countDocuments({ createdAt: { $gte: startDate } }),
      Submission.countDocuments({ status: 'graded', createdAt: { $gte: startDate } }),
      Submission.countDocuments({ createdAt: { $gte: startDate } }),
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

    // Monthly activity (last 8 months)
    const months: { month: string; submissions: number; passed: number }[] = [];
    for (let i = 7; i >= 0; i--) {
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
      { $match: { role: 'student', isActive: true } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } },
      { $limit: 12 },
    ]);

    res.json({
      summary: {
        totalStudents,
        totalExams,
        passRate: Math.round(passRate * 10) / 10,
        avgScore: Math.round(avgScore * 10) / 10,
        totalSubmissions: allSubmissions,
        gradedSubmissions,
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
