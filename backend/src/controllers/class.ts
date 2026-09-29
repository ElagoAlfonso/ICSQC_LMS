import { type Response } from "express";
import mongoose, { type Schema, type Document } from "mongoose";
import { type AuthRequest } from "../middleware/auth";
import { logActivity } from "../utils/activitieslog";
import Class from "../models/class";
import ClassRequest from "../models/classRequest";
import Subject from "../models/subject";
import User from "../models/user";
import { createNotification } from "../utils/notifications";

export const HIGH_SCHOOL_GRADE_LEVELS = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

const validateHighSchoolGrade = (gradeLevel?: string) => {
  if (!gradeLevel) return false;
  return HIGH_SCHOOL_GRADE_LEVELS.includes(gradeLevel);
};

// @desc   Create a new class
// @route  POST /api/classes
// @access Private (Admin only)
export const createClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, section, gradeLevel, academicYear, adviser, subjects } = req.body;
    if (!gradeLevel || !validateHighSchoolGrade(gradeLevel)) {
      res.status(400).json({ message: "Only Grade 7 through Grade 12 are allowed in this LMS." });
      return;
    }
    const normalizedSubjects = Array.isArray(subjects)
      ? [...new Set(subjects.filter((subjectId: any) => Boolean(subjectId)).map((subjectId: any) => subjectId.toString()))]
      : [];

    if (normalizedSubjects.length) {
      const validSubjectCount = await Subject.countDocuments({ _id: { $in: normalizedSubjects }, isActive: true });
      if (validSubjectCount !== normalizedSubjects.length) {
        res.status(400).json({ message: "One or more selected subjects are invalid or inactive." });
        return;
      }
    }

    const existing = await Class.findOne({ name, section, academicYear });
    if (existing) {
      res.status(400).json({ message: "Class already exists for this academic year" });
      return;
    }
    const newClass = await Class.create({ name, section, gradeLevel, academicYear, adviser, subjects: normalizedSubjects });
    await logActivity({
      userId: req.user!._id.toString(),
      action: "CREATE_CLASS",
      details: `Created class ${name} - ${section}`,
    });
    res.status(201).json(newClass);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc   Get all classes (with pagination)
// @route  GET /api/classes
// @access Private
export const getClasses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const academicYear = req.query.academicYear as string;
    const skip = (page - 1) * limit;
    const filter: any = {};

    const accessFilters: any[] = [];
    if (req.user?.role === "teacher") {
      const teacherSubjectIds = await Subject.find({ teacher: req.user._id, isActive: true }).distinct("_id");
      accessFilters.push({
        $or: [
          { adviser: req.user._id },
          { coTeachers: req.user._id },
          { subjects: { $in: teacherSubjectIds.length ? teacherSubjectIds : ["__no_matches__"] } },
        ],
      });
    }

    if (req.user?.role === "student") {
      accessFilters.push({
        isActive: true,
        $or: [{ students: req.user._id }, { _id: req.user.studentClass }],
      });
    }

    if (accessFilters.length) filter.$and = accessFilters;

    if (academicYear) filter.academicYear = academicYear;
    if (search) {
      filter.$and = [...(filter.$and || []), { $or: [
        { name: { $regex: search, $options: "i" } },
        { section: { $regex: search, $options: "i" } },
        { gradeLevel: { $regex: search, $options: "i" } },
      ] }];
    }
    const [total, classes] = await Promise.all([
      Class.countDocuments(filter),
      Class.find(filter)
        .populate("academicYear", "name")
        .populate("adviser", "name email")
        .populate("coTeachers", "name email")
        .populate("students", "name email lrn")
        .populate({ path: "subjects", select: "name code teacher gradeLevel", populate: { path: "teacher", select: "name email" } })
        .sort({ gradeLevel: 1, name: 1 })
        .skip(skip)
        .limit(limit),
    ]);
    res.json({ classes, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc   Get single class
// @route  GET /api/classes/:id
// @access Private
const toObjectIdString = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value._id) return value._id.toString();
    return value.toString();
  }
  return String(value);
};

export const getClassById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate("academicYear", "name startDate endDate")
      .populate("adviser", "name email")
      .populate("coTeachers", "name email")
      .populate("students", "name email lrn")
      .populate({ path: "subjects", select: "name code teacher gradeLevel", populate: { path: "teacher", select: "name email" } });
    if (!cls) {
      res.status(404).json({ message: "Class not found" });
      return;
    }

    const adviserId = toObjectIdString(cls.adviser);
    if (req.user?.role === "teacher") {
      const coTeacherIds = (cls.coTeachers || []).map((teacher) => toObjectIdString(teacher));
      const teachesSubject = await Subject.exists({ _id: { $in: cls.subjects }, teacher: req.user._id });
      if (adviserId !== req.user._id.toString() && !coTeacherIds.includes(req.user._id.toString()) && !teachesSubject) {
        res.status(403).json({ message: "You are not authorized to manage this class." });
        return;
      }
    }

    const studentIds = (cls.students || []).map((student) => toObjectIdString(student)).filter(Boolean) as string[];
    const assignedClassId = toObjectIdString(req.user?.studentClass);
    if (req.user?.role === "student" && !studentIds.includes(req.user._id.toString()) && assignedClassId !== cls._id.toString()) {
      res.status(403).json({ message: "You are not enrolled in this class." });
      return;
    }

    res.json(cls);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc   Update class
// @route  PUT /api/classes/:id
// @access Private (Admin only)
export const updateClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) {
      res.status(404).json({ message: "Class not found" });
      return;
    }
    if (req.body.gradeLevel && !validateHighSchoolGrade(req.body.gradeLevel)) {
      res.status(400).json({ message: "Only Grade 7 through Grade 12 are allowed in this LMS." });
      return;
    }

    if (req.body.subjects !== undefined) {
      const normalizedSubjects = Array.isArray(req.body.subjects)
        ? [...new Set(req.body.subjects.filter((subjectId: any) => Boolean(subjectId)).map((subjectId: any) => String(subjectId)))]
        : [];
      const validSubjectIds = normalizedSubjects.filter((subjectId): subjectId is string => typeof subjectId === "string" && Boolean(subjectId));

      const validSubjectCount = await Subject.countDocuments({
        _id: { $in: validSubjectIds.map((subjectId) => new mongoose.Types.ObjectId(subjectId)) },
        isActive: true,
      });
      if (validSubjectIds.length && validSubjectCount !== validSubjectIds.length) {
        res.status(400).json({ message: "One or more selected subjects are invalid or inactive." });
        return;
      }
      req.body.subjects = validSubjectIds;
    }

    Object.assign(cls, req.body);
    const updated = await cls.save();
    await logActivity({
      userId: req.user!._id.toString(),
      action: "UPDATE_CLASS",
      details: `Updated class ${updated.name} - ${updated.section}`,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc   Delete class
// @route  DELETE /api/classes/:id
// @access Private (Admin only)
export const deleteClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) {
      res.status(404).json({ message: "Class not found" });
      return;
    }
    await cls.deleteOne();
    await logActivity({
      userId: req.user!._id.toString(),
      action: "DELETE_CLASS",
      details: `Deleted class ${cls.name} - ${cls.section}`,
    });
    res.json({ message: "Class deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc   Add student to class
// @route  POST /api/classes/:id/students
// @access Private (Admin only)
export const addStudentToClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) {
      res.status(404).json({ message: "Class not found" });
      return;
    }
    const { studentId } = req.body;
    if (!cls.students.includes(studentId)) {
      cls.students.push(studentId);
      await cls.save();
    }
    res.json({ message: "Student added to class", class: cls });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const removeStudentFromClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) { res.status(404).json({ message: "Class not found" }); return; }
    const studentId = String(req.params.studentId);
    if (req.user?.role === "teacher") {
      const teachesSubject = await Subject.exists({ _id: { $in: cls.subjects }, teacher: req.user._id });
      if (String(cls.adviser) !== String(req.user._id) && !teachesSubject) {
        res.status(403).json({ message: "You do not have permission to manage this class." });
        return;
      }
    }
    cls.students = cls.students.filter((student) => String(student) !== studentId);
    await cls.save();
    await User.findOneAndUpdate({ _id: studentId, studentClass: cls._id.toString() }, { $unset: { studentClass: 1 } });
    res.json({ message: "Student removed from class", class: cls });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const addCoTeacherToClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) { res.status(404).json({ message: "Class not found" }); return; }
    if (req.user?.role !== "admin" && String(cls.adviser) !== req.user?._id.toString()) {
      res.status(403).json({ message: "Only the class adviser can invite a co-teacher." });
      return;
    }
    const teacher = await User.findOne({ _id: req.body.teacherId, role: "teacher", isActive: true }).select("_id");
    if (!teacher) { res.status(404).json({ message: "Active teacher not found" }); return; }
    if (String(cls.adviser) === String(teacher._id)) { res.status(400).json({ message: "The adviser is already assigned to this class." }); return; }
    if (!cls.coTeachers.some((id) => String(id) === String(teacher._id))) {
      cls.coTeachers.push(teacher._id);
      await cls.save();
    }
    res.json({ message: "Co-teacher added to class", class: cls });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const removeCoTeacherFromClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) { res.status(404).json({ message: "Class not found" }); return; }
    if (req.user?.role !== "admin" && String(cls.adviser) !== req.user?._id.toString()) {
      res.status(403).json({ message: "Only the class adviser can remove a co-teacher." });
      return;
    }
    cls.coTeachers = cls.coTeachers.filter((teacher) => String(teacher) !== String(req.params.teacherId));
    await cls.save();
    res.json({ message: "Co-teacher removed from class", class: cls });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const createClassRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== "teacher") {
      res.status(403).json({ message: "Only teachers can request a class." });
      return;
    }

    const { name, section, gradeLevel, academicYear, subject } = req.body;
    if (!name || !section || !gradeLevel || !academicYear || !subject) {
      res.status(400).json({ message: "Missing required class request fields." });
      return;
    }

    if (!validateHighSchoolGrade(gradeLevel)) {
      res.status(400).json({ message: "Only Grade 7 through Grade 12 are allowed in this LMS." });
      return;
    }

    const ownedSubject = await Subject.findOne({ _id: subject, teacher: req.user._id, isActive: true });
    if (!ownedSubject) {
      res.status(403).json({ message: "Please select a valid subject assigned to your account." });
      return;
    }

    const pending = await ClassRequest.findOne({
      teacher: req.user._id,
      academicYear,
      name,
      section,
      status: "pending",
    });

    if (pending) {
      res.status(400).json({ message: "A similar class request is already pending." });
      return;
    }

    const request = await ClassRequest.create({
      teacher: req.user._id,
      name,
      section,
      gradeLevel,
      academicYear,
      subject,
      status: "pending",
    });

    await logActivity({
      userId: req.user._id.toString(),
      action: "CREATE_CLASS_REQUEST",
      details: `Teacher requested class ${name} - ${section}`,
    });

    const admins = await User.find({ role: "admin", isActive: true }).select("_id");
    await Promise.all(admins.map((admin) =>
      createNotification({
        recipient: admin._id,
        title: "Class approval pending",
        message: `${req.user!.name} requested a new class: ${name} - ${section}.`,
        type: "system",
      })
    ));

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const getClassRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: any = {};
    if (req.user?.role === "teacher") filter.teacher = req.user._id;
    const requests = await ClassRequest.find(filter)
      .populate("teacher", "name email")
      .populate("subject", "name code")
      .populate("academicYear", "name")
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const approveClassRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const request = await ClassRequest.findById(req.params.id);
    if (!request) {
      res.status(404).json({ message: "Class request not found" });
      return;
    }

    if (request.status !== "pending") {
      res.status(400).json({ message: "This class request is no longer pending." });
      return;
    }

    const existingClass = await Class.findOne({
      name: request.name,
      section: request.section,
      academicYear: request.academicYear,
    });

    if (existingClass) {
      res.status(400).json({ message: "A class with this name/section/year already exists." });
      return;
    }

    const createdClass = await Class.create({
      name: request.name,
      section: request.section,
      gradeLevel: request.gradeLevel,
      academicYear: request.academicYear,
      adviser: request.teacher,
      subjects: [request.subject],
      students: [],
      inviteCode: `ICS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      approvalStatus: "approved",
      createdBy: req.user!._id,
      isActive: true,
    });

    request.status = "approved";
    request.approvedBy = req.user!._id;
    await request.save();

    await createNotification({
      recipient: request.teacher,
      title: "Class request approved",
      message: `Your class ${request.name} - ${request.section} has been approved.`,
      type: "system",
      relatedResource: createdClass._id,
    });

    await logActivity({
      userId: req.user!._id.toString(),
      action: "APPROVE_CLASS_REQUEST",
      details: `Approved class request ${request.name} - ${request.section}`,
    });

    res.status(200).json({ message: "Class approved and created.", class: createdClass });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const rejectClassRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const request = await ClassRequest.findById(req.params.id);
    if (!request) {
      res.status(404).json({ message: "Class request not found" });
      return;
    }

    if (request.status !== "pending") {
      res.status(400).json({ message: "This request has already been processed." });
      return;
    }

    request.status = "rejected";
    request.rejectedReason = req.body.reason || "No reason provided.";
    request.approvedBy = req.user!._id;
    await request.save();

    await createNotification({
      recipient: request.teacher,
      title: "Class request rejected",
      message: `Your class request for ${request.name} - ${request.section} was rejected. ${request.rejectedReason}`,
      type: "system",
      relatedResource: request._id,
    });

    await logActivity({
      userId: req.user!._id.toString(),
      action: "REJECT_CLASS_REQUEST",
      details: `Rejected class request ${request.name} - ${request.section}`,
    });

    res.json({ message: "Class request rejected." });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const joinClassByCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== "student") {
      res.status(403).json({ message: "Only students can join classes using an invite code." });
      return;
    }

    const { code } = req.body;
    if (!code) {
      res.status(400).json({ message: "Invite code is required." });
      return;
    }

    const cls = await Class.findOne({ inviteCode: code.trim().toUpperCase() }).populate("adviser", "name email");
    if (!cls) {
      res.status(404).json({ message: "Invalid code." });
      return;
    }

    if (!cls.isActive) {
      res.status(400).json({ message: "This class is not active." });
      return;
    }

    if (cls.inviteExpiresAt && new Date(cls.inviteExpiresAt).getTime() < Date.now()) {
      res.status(400).json({ message: "Expired code." });
      return;
    }

    if (cls.students.some((studentId) => studentId.toString() === req.user!._id.toString())) {
      res.status(400).json({ message: "Already enrolled." });
      return;
    }

    if (cls.maxStudents && cls.students.length >= cls.maxStudents) {
      res.status(400).json({ message: "Class full." });
      return;
    }

    cls.students.push(req.user!._id as any);
    await cls.save();

    const student = await User.findById(req.user!._id);
    if (student) {
      student.studentClass = cls._id as any;
      await student.save();
    }

    await createNotification({
      recipient: cls.adviser,
      title: "Student joined class",
      message: `${req.user!.name} joined ${cls.name} - ${cls.section}.`,
      type: "system",
      relatedResource: cls._id,
    });

    await logActivity({
      userId: req.user!._id.toString(),
      action: "JOIN_CLASS",
      details: `Student joined class ${cls.name} - ${cls.section}`,
    });

    res.json({ message: "Joined class successfully.", class: cls });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};
