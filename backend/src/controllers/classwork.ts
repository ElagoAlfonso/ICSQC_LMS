import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth";
import { logActivity } from "../utils/activitieslog";
import { createNotification, createNotifications } from "../utils/notifications";
import Classwork from "../models/classwork";
import ClassworkSubmission from "../models/classworkSubmission";
import ClassworkGrade from "../models/classworkGrade";
import Rubric from "../models/rubric";
import Class from "../models/class";
import Subject from "../models/subject";
import User from "../models/user";
import AcademicYear from "../models/academicYear";
import { emitAcademicUpdate } from "../realtime";
import { removeStoredAttachment, saveAttachment, validateAttachment } from "../utils/attachments";

// ═══════════════════════════════════════════════════════════════════════════
//  VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const validateTeacherClassworkAccess = async (user: AuthRequest["user"], classId: string) => {
  if (!user) return null;

  if (user.role === "admin") {
    return await Class.findById(classId);
  }

  if (user.role !== "teacher") {
    return null;
  }

  const classDoc = await Class.findById(classId);
  if (!classDoc) {
    return null;
  }

  const classAdviserId = classDoc.adviser ? classDoc.adviser.toString() : null;
  const isCoTeacher = (classDoc.coTeachers || []).some((teacherId) => teacherId.toString() === user._id.toString());
  if (classAdviserId !== user._id.toString() && !isCoTeacher) {
    return null;
  }

  return classDoc;
};

const canManageClasswork = async (user: AuthRequest["user"], classId: any, createdBy: any) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;
  if (createdBy?.toString() === user._id.toString()) return true;
  return Boolean(await Class.exists({ _id: classId, $or: [{ adviser: user._id }, { coTeachers: user._id }] }));
};

const publicAttachments = (attachments: any[] = []) => attachments.map(({ storageName, storagePath, ...attachment }) => attachment);
const MAX_RESOURCE_LINKS = 10;

const validateRubricScores = async (rubricId: any, inputScores: any): Promise<
  { scores: Array<{ criterionId: string; score: number }>; total: number } | { error: string }
> => {
  const rubric = await Rubric.findById(rubricId);
  if (!rubric) return { error: "The attached rubric could not be found." };
  if (!Array.isArray(inputScores) || inputScores.length !== rubric.criteria.length) {
    return { error: "Enter a score for every rubric criterion." };
  }
  const scoreMap = new Map<string, number>();
  for (const entry of inputScores) {
    if (!entry || typeof entry.criterionId !== "string" || typeof entry.score !== "number" || !Number.isFinite(entry.score)) {
      return { error: "Rubric scores must contain a valid score for each criterion." };
    }
    scoreMap.set(entry.criterionId, entry.score);
  }
  const scores: Array<{ criterionId: string; score: number }> = [];
  for (const criterion of rubric.criteria) {
    const score = scoreMap.get(criterion.id);
    if (score === undefined || score < 0 || score > criterion.maxPoints) {
      return { error: `Each criterion score must be between 0 and its maximum of ${criterion.maxPoints}.` };
    }
    scores.push({ criterionId: criterion.id, score });
  }
  return { scores, total: scores.reduce((sum, entry) => sum + entry.score, 0) };
};

// ═══════════════════════════════════════════════════════════════════════════
//  CLASSWORK CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const createClasswork = async (req: AuthRequest, res: Response): Promise<void> => {
  const savedPaths: string[] = [];
  try {
    const { classId, subjectId, title, description, type, dueDate, dueTime, points, instructions, allowLateSubmission, submissionMode, questions, rubricId } = req.body;

    const materialOnly = type === "syllabus" || type === "lesson";
    if (!classId || !title || !description || !type || (!dueDate && !materialOnly)) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    // Validate teacher access to class
    if (req.user?.role === "teacher") {
      const classDoc = await validateTeacherClassworkAccess(req.user, classId);
      if (!classDoc) {
        res.status(403).json({ message: "You do not have access to this class" });
        return;
      }
    }

    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      res.status(404).json({ message: "Class not found" });
      return;
    }

    const subjectDoc = subjectId ? await Subject.findById(subjectId) : null;
    if (!subjectDoc) {
      res.status(404).json({ message: "Subject not found" });
      return;
    }

    const academicYearId = classDoc.academicYear || (await AcademicYear.findOne({ isCurrent: true }))?._id;
    if (!academicYearId) {
      res.status(400).json({ message: "No academic year found" });
      return;
    }

    let rubric = null;
    if (rubricId) {
      rubric = await Rubric.findOne({ _id: rubricId, createdBy: req.user?._id });
      if (!rubric) {
        res.status(404).json({ message: "Rubric not found or unavailable to your account." });
        return;
      }
    }

    const parsedQuestions = typeof req.body.questions === "string"
      ? JSON.parse(req.body.questions || "[]")
      : req.body.questions;
    const parsedResourceLinks = typeof req.body.resourceLinks === "string"
      ? JSON.parse(req.body.resourceLinks || "[]")
      : (req.body.resourceLinks || []);
    if (!Array.isArray(parsedResourceLinks) || parsedResourceLinks.length > MAX_RESOURCE_LINKS) {
      res.status(400).json({ message: `Add no more than ${MAX_RESOURCE_LINKS} lesson links.` });
      return;
    }
    const resourceLinks = [];
    for (const link of parsedResourceLinks) {
      if (!link || typeof link.url !== "string") {
        res.status(400).json({ message: "Each lesson link must have a valid web address." });
        return;
      }
      try {
        const url = new URL(link.url.trim());
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.href.length > 2048) {
          res.status(400).json({ message: "Lesson links must be valid HTTP or HTTPS addresses." });
          return;
        }
        const title = typeof link.title === "string" ? link.title.trim().slice(0, 120) : "";
        resourceLinks.push({ title: title || url.hostname, url: url.href });
      } catch {
        res.status(400).json({ message: "Lesson links must be valid HTTP or HTTPS addresses." });
        return;
      }
    }

    const uploadedFiles = (req.files as Express.Multer.File[] | undefined) || [];
    const attachments = [];
    for (const file of uploadedFiles) {
      const extension = validateAttachment(file);
      const stored = await saveAttachment(file, extension);
      savedPaths.push(stored.storagePath);
      attachments.push({
        originalName: file.originalname,
        ...stored,
        extension,
        mimeType: file.mimetype,
        size: file.size,
      });
    }
    const classwork = new Classwork({
      title,
      description,
      type,
      submissionMode: type === "assessment" ? "response" : (submissionMode || "response"),
      status: "draft",
      class: classId,
      subject: subjectId,
      rubric: rubric?._id,
      createdBy: req.user?._id,
      academicYear: academicYearId,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      dueTime,
      points: rubric ? rubric.criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0) : points || 0,
      instructions,
      allowLateSubmission: allowLateSubmission === true || allowLateSubmission === "true",
      questions: type === "assessment" ? (parsedQuestions || []) : [],
      attachments,
      resourceLinks,
    });

    await classwork.save();
    emitAcademicUpdate({ classId: classwork.class.toString(), kind: "classwork" });
    await logActivity({ userId: req.user?._id.toString() || "", action: `Created classwork: ${title}`, details: JSON.stringify({ classworkId: classwork._id, classId }) });

    res.status(201).json({
      message: "Classwork created successfully",
      classwork: { ...classwork.toObject(), attachments: publicAttachments(classwork.attachments as any[]) },
    });
  } catch (error) {
    await Promise.all(savedPaths.map(removeStoredAttachment));
    console.error("Error creating classwork:", error);
    const message = (error as Error).message;
    const isUploadError = message.includes("file type") || message.includes("maximum allowed") || message.includes("MIME type") || message.includes("signature");
    res.status(isUploadError || error instanceof SyntaxError ? 400 : 500).json({ message: isUploadError ? message : error instanceof SyntaxError ? "Assessment questions could not be read." : "Error creating classwork" });
  }
};

export const getClasswork = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId, status, type } = req.query;

    const filter: any = {};
    if (classId) filter.class = classId;
    if (status) filter.status = status;
    if (type) filter.type = type;

    // Students should only see published classwork
    if (req.user?.role === "student") {
      filter.status = "published";
      if (classId) {
        const enrolledClass = await Class.exists({
          _id: classId,
          ...(req.user.studentClass
            ? {
                gradeLevel: (await Class.findById(req.user.studentClass).select("gradeLevel").lean())?.gradeLevel,
              }
            : { students: req.user._id }),
        });
        if (!enrolledClass) {
          res.status(403).json({ message: "You are not enrolled in this class" });
          return;
        }
      } else {
        const assignedClass = req.user.studentClass ? await Class.findById(req.user.studentClass).select("gradeLevel").lean() : null;
        const enrolledClasses = await Class.find({
          ...(assignedClass?.gradeLevel ? { gradeLevel: assignedClass.gradeLevel } : {}),
          ...(req.user.studentClass ? {} : { students: req.user._id }),
        }).select("_id").lean();
        filter.class = { $in: enrolledClasses.map((enrolledClass) => enrolledClass._id) };
      }
      if (req.query.includeSubmitted !== "true") {
        const submittedClassworkIds = await ClassworkSubmission.find({ student: req.user._id }).distinct("classwork");
        filter._id = { $nin: submittedClassworkIds };
      }
    }

    const classwork = await Classwork.find(filter)
      .populate("class")
      .populate("subject")
      .populate("rubric")
      .populate("createdBy", "name email")
      .sort({ dueDate: 1 })
      .lean();

    const safeClasswork = classwork.map((item: any) => ({ ...item, attachments: publicAttachments(item.attachments) }));

    res.status(200).json({
      message: "Classwork retrieved successfully",
      classwork: safeClasswork,
    });
  } catch (error) {
    console.error("Error fetching classwork:", error);
    res.status(500).json({ message: "Error fetching classwork", error: (error as Error).message });
  }
};

export const getClassworkById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classworkId } = req.params;

    const classwork = await Classwork.findById(classworkId)
      .populate("class")
      .populate("subject")
      .populate("rubric")
      .populate("createdBy", "name email")
      .lean();

    if (!classwork) {
      res.status(404).json({ message: "Classwork not found" });
      return;
    }

    // Students can only view published classwork
    if (req.user?.role === "student" && classwork.status !== "published") {
      res.status(403).json({ message: "This classwork is not available yet" });
      return;
    }

    if (req.user?.role === "student") {
      const classId = (classwork.class as any)?._id || classwork.class;
      const enrolledClass = await Class.exists({
        _id: classId,
        ...(req.user.studentClass
          ? {
              gradeLevel: (await Class.findById(req.user.studentClass).select("gradeLevel").lean())?.gradeLevel,
            }
          : { students: req.user._id }),
      });
      if (!enrolledClass) {
        res.status(403).json({ message: "You are not enrolled in this class" });
        return;
      }

      (classwork as any).questionCount = Array.isArray(classwork.questions) ? classwork.questions.length : 0;
      (classwork as any).questionPoints = Array.isArray(classwork.questions)
        ? classwork.questions.map((question: any) => question.points ?? 1)
        : [];
      (classwork as any).questions = [];
      (classwork as any).attachments = publicAttachments((classwork as any).attachments);
      const submitted = await ClassworkSubmission.exists({ classwork: classworkId, student: req.user._id });
    } else {
      (classwork as any).attachments = publicAttachments((classwork as any).attachments);
    }

    res.status(200).json({
      message: "Classwork retrieved successfully",
      classwork,
    });
  } catch (error) {
    console.error("Error fetching classwork:", error);
    res.status(500).json({ message: "Error fetching classwork", error: (error as Error).message });
  }
};

export const updateClasswork = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classworkId } = req.params;
    const { title, description, dueDate, dueTime, points, instructions, allowLateSubmission } = req.body;

    const classwork = await Classwork.findById(classworkId);
    if (!classwork) {
      res.status(404).json({ message: "Classwork not found" });
      return;
    }

    // Only creator/admin can edit
    if (!(await canManageClasswork(req.user, classwork.class, classwork.createdBy))) {
      res.status(403).json({ message: "You do not have permission to edit this classwork" });
      return;
    }

    // Can't edit published classwork (draft only)
    if (classwork.status !== "draft") {
      res.status(400).json({ message: "Can only edit draft classwork" });
      return;
    }

    const updates: any = {};
    if (title) updates.title = title;
    if (description) updates.description = description;
    if (dueDate) updates.dueDate = new Date(dueDate);
    if (dueTime) updates.dueTime = dueTime;
    if (points !== undefined) updates.points = points;
    if (instructions) updates.instructions = instructions;
    if (allowLateSubmission !== undefined) updates.allowLateSubmission = allowLateSubmission;

    const updated = await Classwork.findByIdAndUpdate(classworkId, updates, { new: true });
    await logActivity({ userId: req.user?._id.toString() || "", action: `Updated classwork: ${updated?.title}`, details: JSON.stringify({ classworkId }) });

    res.status(200).json({
      message: "Classwork updated successfully",
      classwork: updated,
    });
  } catch (error) {
    console.error("Error updating classwork:", error);
    res.status(500).json({ message: "Error updating classwork", error: (error as Error).message });
  }
};

export const deleteClasswork = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classworkId } = req.params;

    const classwork = await Classwork.findById(classworkId);
    if (!classwork) {
      res.status(404).json({ message: "Classwork not found" });
      return;
    }

    // Only creator/admin can delete
    if (!(await canManageClasswork(req.user, classwork.class, classwork.createdBy))) {
      res.status(403).json({ message: "You do not have permission to delete this classwork" });
      return;
    }

    await Promise.all(classwork.attachments.map((attachment) => removeStoredAttachment(attachment.storagePath)));
    await Classwork.findByIdAndDelete(classworkId);
    await Promise.all([
      ClassworkSubmission.deleteMany({ classwork: classworkId }),
      ClassworkGrade.deleteMany({ classwork: classworkId }),
    ]);
    await logActivity({ userId: req.user?._id.toString() || "", action: `Deleted classwork: ${classwork.title}`, details: JSON.stringify({ classworkId }) });
    emitAcademicUpdate({ classId: classwork.class.toString(), kind: "classwork" });

    res.status(200).json({ message: "Classwork deleted successfully" });
  } catch (error) {
    console.error("Error deleting classwork:", error);
    res.status(500).json({ message: "Error deleting classwork", error: (error as Error).message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
//  CLASSWORK PUBLISHING/SCHEDULING
// ═══════════════════════════════════════════════════════════════════════════

export const publishClasswork = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classworkId } = req.params;
    const { scheduleDate, scheduleTime } = req.body || {};

    const classwork = await Classwork.findById(classworkId);
    if (!classwork) {
      res.status(404).json({ message: "Classwork not found" });
      return;
    }

    // Only creator/admin can publish
    if (!(await canManageClasswork(req.user, classwork.class, classwork.createdBy))) {
      res.status(403).json({ message: "You do not have permission to publish this classwork" });
      return;
    }

    if (scheduleDate && scheduleTime) {
      // Schedule for later
      classwork.status = "scheduled";
      classwork.scheduledPublishDate = new Date(scheduleDate);
      classwork.scheduledPublishTime = scheduleTime;
    } else {
      // Publish immediately
      classwork.status = "published";
      classwork.publishedAt = new Date();
    }

    await classwork.save();

    // Create notifications for students in the class
    const classDoc = await Class.findById(classwork.class);
    if (classDoc?.students && classDoc.students.length > 0) {
      try {
        await createNotifications(classDoc.students, {
          title: "New Classwork",
          message: `${classwork.type}: ${classwork.title} has been assigned`,
          type: "announcement",
          relatedResource: classwork._id,
          relatedClass: classwork.class,
        });
      } catch (notificationError) {
        console.error("Unable to notify students about published classwork:", notificationError);
      }
    }

    await logActivity({ userId: req.user?._id.toString() || "", action: `Published classwork: ${classwork.title}`, details: JSON.stringify({ classworkId }) });

    res.status(200).json({
      message: scheduleDate ? "Classwork scheduled successfully" : "Classwork published successfully",
      classwork,
    });
  } catch (error) {
    console.error("Error publishing classwork:", error);
    res.status(500).json({ message: "Error publishing classwork", error: (error as Error).message });
  }
};

export const closeClasswork = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classworkId } = req.params;

    const classwork = await Classwork.findById(classworkId);
    if (!classwork) {
      res.status(404).json({ message: "Classwork not found" });
      return;
    }

    // Only creator/admin can close
    if (!(await canManageClasswork(req.user, classwork.class, classwork.createdBy))) {
      res.status(403).json({ message: "You do not have permission to close this classwork" });
      return;
    }

    classwork.status = "closed";
    classwork.closedAt = new Date();
    await classwork.save();

    await logActivity({ userId: req.user?._id.toString() || "", action: `Closed classwork: ${classwork.title}`, details: JSON.stringify({ classworkId }) });

    res.status(200).json({
      message: "Classwork closed successfully",
      classwork,
    });
  } catch (error) {
    console.error("Error closing classwork:", error);
    res.status(500).json({ message: "Error closing classwork", error: (error as Error).message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
//  SUBMISSION HANDLING
// ═══════════════════════════════════════════════════════════════════════════

export const submitClasswork = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classworkId } = req.params;
    const { submittedNotes } = req.body || {};

    const classwork = await Classwork.findById(classworkId);
    if (!classwork) {
      res.status(404).json({ message: "Classwork not found" });
      return;
    }

    if (classwork.status !== "published") {
      res.status(400).json({ message: "This classwork is not open for submission" });
      return;
    }
    if (classwork.type === "syllabus" || classwork.type === "lesson") {
      res.status(400).json({ message: "This material does not accept submissions." });
      return;
    }

    const now = new Date();
    const isLate = Boolean(classwork.dueDate && now > classwork.dueDate);

    if (isLate && !classwork.allowLateSubmission) {
      res.status(400).json({ message: "This classwork no longer accepts submissions" });
      return;
    }

    // Check if already submitted
    const existingSubmission = await ClassworkSubmission.findOne({
      classwork: classworkId,
      student: req.user?._id,
    });

    if (existingSubmission && !req.body.isRevision) {
      res.status(400).json({ message: "You have already submitted this classwork. Use revision to update." });
      return;
    }

    const uploadedFiles = (req.files as Express.Multer.File[] | undefined) || [];
    const savedPaths: string[] = [];
    let attachments: any[] = [];
    try {
      attachments = await Promise.all(uploadedFiles.map(async (file) => {
        const extension = validateAttachment(file);
        const stored = await saveAttachment(file, extension);
        savedPaths.push(stored.storagePath);
        return {
          originalName: file.originalname,
          storageName: stored.storageName,
          storagePath: stored.storagePath,
          extension,
          mimeType: file.mimetype,
          size: file.size,
          uploadedAt: new Date(),
        };
      }));
    } catch (uploadError) {
      for (const storagePath of savedPaths) {
        try { await (await import("../utils/attachments")).removeStoredAttachment(storagePath); } catch { /* best effort cleanup */ }
      }
      res.status(400).json({ message: (uploadError as Error).message || "Unable to upload submission files." });
      return;
    }

    const submission = new ClassworkSubmission({
      classwork: classworkId,
      student: req.user?._id,
      class: classwork.class,
      subject: classwork.subject,
      submittedNotes,
      attachments,
      totalPoints: classwork.points,
      isLate,
      status: isLate ? "late" : "submitted",
      submittedAt: new Date(),
    });

    if (existingSubmission) {
      submission.revisionCount = (existingSubmission.revisionCount || 1) + 1;
      submission.lastRevisedAt = new Date();
    }

    await submission.save();
  emitAcademicUpdate({ classId: classwork.class.toString(), kind: "submission" });

    // Update classwork submission count
    await Classwork.findByIdAndUpdate(classworkId, {
      $inc: { totalSubmissions: 1 },
    });

    // Notify teacher
    const classwork_doc = await Classwork.findById(classworkId).populate("createdBy");
    if (classwork_doc?.createdBy) {
      try {
        await createNotification({
          recipient: (classwork_doc.createdBy as any)._id,
          title: "New Submission",
          message: `Student submitted: ${classwork.title}`,
          type: "submission",
          relatedResource: submission._id,
          relatedClass: classwork.class,
        });
      } catch (notificationError) {
        console.error("Unable to notify teacher about submission:", notificationError);
      }
    }

    await logActivity({ userId: req.user?._id.toString() || "", action: `Submitted classwork: ${classwork.title}`, details: JSON.stringify({ classworkId, submissionId: submission._id }) });

    res.status(201).json({
      message: "Classwork submitted successfully",
      submission,
    });
  } catch (error) {
    console.error("Error submitting classwork:", error);
    res.status(500).json({ message: "Error submitting classwork", error: (error as Error).message });
  }
};

export const getSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classworkId } = req.params;
    const { status } = req.query;

    const classwork = await Classwork.findById(classworkId);
    if (!classwork) {
      res.status(404).json({ message: "Classwork not found" });
      return;
    }

    // Only teacher/admin who created can view
    if (!(await canManageClasswork(req.user, classwork.class, classwork.createdBy))) {
      res.status(403).json({ message: "You do not have permission to view submissions" });
      return;
    }

    const filter: any = { classwork: classworkId };
    if (status) filter.status = status;

    const submissions = await ClassworkSubmission.find(filter)
      .populate("student", "name email")
      .sort({ submittedAt: -1 })
      .lean();

    res.status(200).json({
      message: "Submissions retrieved successfully",
      submissions,
    });
  } catch (error) {
    console.error("Error fetching submissions:", error);
    res.status(500).json({ message: "Error fetching submissions", error: (error as Error).message });
  }
};

export const getClassworkGrades = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classwork = await Classwork.findById(req.params.classworkId);
    if (!classwork) {
      res.status(404).json({ message: "Classwork not found" });
      return;
    }
    if (!(await canManageClasswork(req.user, classwork.class, classwork.createdBy))) {
      res.status(403).json({ message: "You do not have permission to view these grades" });
      return;
    }

    const grades = await ClassworkGrade.find({ classwork: classwork._id })
      .populate("student", "name email lrn")
      .sort({ gradedAt: -1 })
      .lean();
    res.status(200).json({ grades });
  } catch (error) {
    console.error("Error fetching classwork grades:", error);
    res.status(500).json({ message: "Error fetching classwork grades" });
  }
};

export const saveClassworkGrade = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classworkId, studentId } = req.params;
    const { score, feedback, rubricScores } = req.body;
    const classwork = await Classwork.findById(classworkId);
    if (!classwork) {
      res.status(404).json({ message: "Classwork not found" });
      return;
    }
    if (!(await canManageClasswork(req.user, classwork.class, classwork.createdBy))) {
      res.status(403).json({ message: "You do not have permission to grade this classwork" });
      return;
    }
    const classDoc = await Class.findById(classwork.class).select("students");
    if (!classDoc?.students.some((id) => id.toString() === studentId)) {
      res.status(404).json({ message: "Student is not enrolled in this class" });
      return;
    }
    let resolvedScore = score as number;
    let resolvedRubricScores: Array<{ criterionId: string; score: number }> | undefined;
    if (classwork.rubric) {
      const validated = await validateRubricScores(classwork.rubric, rubricScores);
      if ("error" in validated) {
        res.status(400).json({ message: validated.error });
        return;
      }
      resolvedScore = validated.total;
      resolvedRubricScores = validated.scores;
    }
    if (typeof resolvedScore !== "number" || !Number.isFinite(resolvedScore) || resolvedScore < 0 || resolvedScore > classwork.points) {
      res.status(400).json({ message: `Score must be between 0 and ${classwork.points}` });
      return;
    }

    let grade = await ClassworkGrade.findOne({ classwork: classwork._id, student: studentId });
    if (!grade) {
      grade = new ClassworkGrade({
        classwork: classwork._id,
        student: studentId,
        class: classwork.class,
        subject: classwork.subject,
        gradedBy: req.user?._id,
      });
    }
    grade.score = resolvedScore;
    grade.totalPoints = classwork.points;
    grade.percentage = classwork.points > 0 ? (score / classwork.points) * 100 : 0;
    grade.feedback = typeof feedback === "string" ? feedback.trim() : "";
    grade.rubricScores = resolvedRubricScores;
    grade.gradedBy = req.user!._id;
    grade.gradedAt = new Date();
    await grade.save();
    await grade.populate("student", "name email lrn");

    emitAcademicUpdate({ classId: classwork.class.toString(), kind: "classwork" });
    await logActivity({ userId: req.user?._id.toString() || "", action: `Entered classwork grade: ${classwork.title}`, details: JSON.stringify({ classworkId, studentId, score: resolvedScore }) });
    res.status(200).json({ message: "Grade saved successfully", grade });
  } catch (error) {
    console.error("Error saving classwork grade:", error);
    res.status(500).json({ message: "Error saving classwork grade" });
  }
};

export const getMySubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId } = req.query;

    const filter: any = { student: req.user?._id };
    if (classId) filter.class = classId;

    const submissions = await ClassworkSubmission.find(filter)
      .populate("classwork")
      .sort({ submittedAt: -1 })
      .lean();

    res.status(200).json({
      message: "Your submissions retrieved successfully",
      submissions,
    });
  } catch (error) {
    console.error("Error fetching submissions:", error);
    res.status(500).json({ message: "Error fetching submissions", error: (error as Error).message });
  }
};

export const gradeSubmission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { submissionId } = req.params;
    const { score, feedback, rubricScores } = req.body;

    const submission = await ClassworkSubmission.findById(submissionId);
    if (!submission) {
      res.status(404).json({ message: "Submission not found" });
      return;
    }

    const classwork = await Classwork.findById(submission.classwork);
    if (!classwork) {
      res.status(404).json({ message: "Classwork not found" });
      return;
    }

    // Only teacher/admin who created classwork can grade
    if (!(await canManageClasswork(req.user, classwork.class, classwork.createdBy))) {
      res.status(403).json({ message: "You do not have permission to grade this submission" });
      return;
    }

    let resolvedScore = score as number;
    let resolvedRubricScores: Array<{ criterionId: string; score: number }> | undefined;
    if (classwork.rubric) {
      const validated = await validateRubricScores(classwork.rubric, rubricScores);
      if ("error" in validated) {
        res.status(400).json({ message: validated.error });
        return;
      }
      resolvedScore = validated.total;
      resolvedRubricScores = validated.scores;
    }
    if (typeof resolvedScore !== "number" || !Number.isFinite(resolvedScore) || resolvedScore < 0 || resolvedScore > submission.totalPoints) {
      res.status(400).json({ message: `Score must be between 0 and ${submission.totalPoints}` });
      return;
    }

    submission.score = resolvedScore;
    submission.percentage = (resolvedScore / submission.totalPoints) * 100;
    submission.feedback = feedback;
    submission.rubricScores = resolvedRubricScores;
    submission.gradedAt = new Date();
    submission.gradedBy = req.user?._id;
    submission.status = "graded";

    await submission.save();

    // Update classwork graded count
    await Classwork.findByIdAndUpdate(submission.classwork, {
      $inc: { gradedSubmissions: 1 },
    });

    // Notify student
    await createNotification({
      recipient: submission.student,
      title: "Classwork Graded",
      message: `${classwork.title} has been graded`,
      type: "submission",
      relatedResource: submission._id,
      relatedClass: submission.class,
    });

    await logActivity({ userId: req.user?._id.toString() || "", action: `Graded submission for: ${classwork.title}`, details: JSON.stringify({ submissionId, classworkId: classwork._id }) });

    res.status(200).json({
      message: "Submission graded successfully",
      submission,
    });
  } catch (error) {
    console.error("Error grading submission:", error);
    res.status(500).json({ message: "Error grading submission", error: (error as Error).message });
  }
};
