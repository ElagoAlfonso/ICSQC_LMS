import { type Express, type Response } from "express";
import { type AuthRequest } from "../middleware/auth";
import { logActivity } from "../utils/activitieslog";
import Subject, { HIGH_SCHOOL_GRADE_LEVELS } from "../models/subject";
import Class from "../models/class";
import Announcement from "../models/announcement";
import User from "../models/user";
import Exam from "../models/exam";
import { removeStoredAttachment, saveAttachment, validateAttachment } from "../utils/attachments";

const subjectIdForUser = (user: AuthRequest["user"], subjectId: string) => {
  if (user?.role === "admin") return null;
  if (user?.role === "teacher") return { teacher: user._id, _id: subjectId };
  return { _id: subjectId };
};

const getSubjectClasses = async (user: AuthRequest["user"], subjectId: string) => {
  const filter: any = { subjects: subjectId, isActive: true };
  if (user?.role === "student") filter.students = user._id;
  return Class.find(filter).populate("academicYear", "name").populate("students", "name email");
};

export const createSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, description, teacher, gradeLevel, academicYear, units } = req.body;
    if (!gradeLevel || !HIGH_SCHOOL_GRADE_LEVELS.includes(gradeLevel)) {
      res.status(400).json({ message: "Please select a valid high school grade level." });
      return;
    }
    const existing = await Subject.findOne({ code, academicYear });
    if (existing) {
      res.status(400).json({ message: "Subject code already exists for this academic year" });
      return;
    }
    const subject = await Subject.create({ name, code, description, teacher, gradeLevel, academicYear, units });
    await logActivity({
      userId: req.user!._id.toString(),
      action: "CREATE_SUBJECT",
      details: `Created subject ${name} (${code})`,
    });
    res.status(201).json(subject);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const getSubjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const academicYear = req.query.academicYear as string;
    const gradeLevel = req.query.gradeLevel as string;
    const skip = (page - 1) * limit;
    const filter: any = {};
    if (academicYear) filter.academicYear = academicYear;
    if (gradeLevel) filter.gradeLevel = gradeLevel;
    // Teachers see only their subjects
    if (req.user?.role === "teacher") filter.teacher = req.user._id;
    if (req.user?.role === "student") {
      const studentClasses = await Class.find({ students: req.user._id }).select("subjects");
      const subjectIds = [...new Set(studentClasses.flatMap((cls) => cls.subjects.map((subjectId) => subjectId.toString())))];
      filter._id = { $in: subjectIds.length ? subjectIds : ["__no_matches__"] };
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }
    const [total, subjects] = await Promise.all([
      Subject.countDocuments(filter),
      Subject.find(filter)
        .populate("teacher", "name email")
        .populate("academicYear", "name")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit),
    ]);
    res.json({ subjects, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const getSubjectById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subjectId = req.params.id as string;
    const subject = await Subject.findById(req.params.id)
      .populate("teacher", "name email")
      .populate("academicYear", "name");
    if (!subject) {
      res.status(404).json({ message: "Subject not found" });
      return;
    }
    if (req.user?.role === "student" && !(await getSubjectClasses(req.user, subjectId)).length) {
      res.status(403).json({ message: "You are not enrolled in this subject." });
      return;
    }
    const teacherId = (subject.teacher as any)?._id?.toString() || subject.teacher?.toString();
    if (req.user?.role === "teacher" && teacherId !== req.user._id.toString()) {
      res.status(403).json({ message: "You are not assigned to this subject." });
      return;
    }
    res.json(subject);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const getSubjectWorkspace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subjectId = req.params.id as string;
    const subject = await Subject.findOne(subjectIdForUser(req.user, subjectId) || { _id: subjectId })
      .populate("teacher", "name email")
      .populate("academicYear", "name startDate endDate");
    if (!subject) { res.status(404).json({ message: "Subject not found" }); return; }

    const classes = await getSubjectClasses(req.user, subjectId);
    if (req.user?.role !== "admin" && !classes.length && req.user?.role !== "teacher") {
      res.status(403).json({ message: "You are not enrolled in this subject." });
      return;
    }
    const classIds = classes.map((item) => item._id);
    const postDocuments = await Announcement.find({ subject: subject._id, isActive: true, targetClass: { $in: classIds } })
      .populate("author", "name role")
      .sort({ isPinned: -1, createdAt: -1 })
      .lean();
    const posts = postDocuments.map((post: any) => ({
      ...post,
      attachments: (post.attachments || []).map(({ storageName, storagePath, ...metadata }: any) => metadata),
    }));
    const examFilter: any = { subject: subject._id, class: { $in: classIds } };
    if (req.user?.role === "student") examFilter.status = "published";
    const exams = await Exam.find(examFilter).select("title description examType status startDate endDate totalPoints").sort({ startDate: 1 });
    const students = classes.flatMap((item: any) => item.students || []).filter((student: any, index: number, all: any[]) =>
      all.findIndex((candidate) => candidate._id.toString() === student._id.toString()) === index
    );
    res.json({ subject, classes, students, posts, exams });
  } catch (error) { res.status(500).json({ message: "Server Error", error }); }
};

export const createSubjectPost = async (req: AuthRequest, res: Response): Promise<void> => {
  const savedPaths: string[] = [];
  try {
    const subject = await Subject.findOne({ _id: req.params.id, teacher: req.user!._id });
    if (!subject) { res.status(403).json({ message: "You are not assigned to this subject." }); return; }
    const classes = await Class.find({ subjects: subject._id, isActive: true });
    if (!classes.length) { res.status(403).json({ message: "You are not authorized to post to this subject." }); return; }
    const { title, content, targetClass } = req.body;
    if (!title?.trim() || !content?.trim()) { res.status(400).json({ message: "Title and message are required." }); return; }
    const selectedClass = targetClass ? classes.find((item) => item._id.toString() === targetClass) : classes[0];
    if (!selectedClass) { res.status(403).json({ message: "The selected class is not assigned to you for this subject." }); return; }
    const files = (req.files || []) as Express.Multer.File[];
    const attachments = [];
    for (const file of files) {
      const extension = validateAttachment(file);
      const stored = await saveAttachment(file, extension);
      savedPaths.push(stored.storagePath);
      attachments.push({ originalName: file.originalname, ...stored, extension, mimeType: file.mimetype, size: file.size });
    }
    const post = await Announcement.create({ title, content, subject: subject._id, targetClass: selectedClass._id, author: req.user!._id, targetRole: "student", attachments });
    res.status(201).json(await post.populate("author", "name role"));
  } catch (error: any) {
    await Promise.all(savedPaths.map(removeStoredAttachment));
    const message = error?.message || "Unable to publish subject post.";
    res.status(message.includes("file") || message.includes("File") || message.includes("MIME") ? 400 : 500).json({ message });
  }
};

export const updateSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      res.status(404).json({ message: "Subject not found" });
      return;
    }
    if (req.body.gradeLevel && !HIGH_SCHOOL_GRADE_LEVELS.includes(req.body.gradeLevel)) {
      res.status(400).json({ message: "Please select a valid high school grade level." });
      return;
    }
    Object.assign(subject, req.body);
    const updated = await subject.save();
    await logActivity({
      userId: req.user!._id.toString(),
      action: "UPDATE_SUBJECT",
      details: `Updated subject ${updated.name}`,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const deleteSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      res.status(404).json({ message: "Subject not found" });
      return;
    }
    await subject.deleteOne();
    await logActivity({
      userId: req.user!._id.toString(),
      action: "DELETE_SUBJECT",
      details: `Deleted subject ${subject.name}`,
    });
    res.json({ message: "Subject deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};
