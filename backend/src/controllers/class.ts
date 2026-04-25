import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth";
import { logActivity } from "../utils/activitieslog";
import Class from "../models/class";
import Subject from "../models/subject";

// @desc   Create a new class
// @route  POST /api/classes
// @access Private (Admin only)
export const createClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, section, gradeLevel, academicYear, adviser } = req.body;
    const existing = await Class.findOne({ name, section, academicYear });
    if (existing) {
      res.status(400).json({ message: "Class already exists for this academic year" });
      return;
    }
    const newClass = await Class.create({ name, section, gradeLevel, academicYear, adviser });
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
    if (academicYear) filter.academicYear = academicYear;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { section: { $regex: search, $options: "i" } },
        { gradeLevel: { $regex: search, $options: "i" } },
      ];
    }
    const [total, classes] = await Promise.all([
      Class.countDocuments(filter),
      Class.find(filter)
        .populate("academicYear", "name")
        .populate("adviser", "name email")
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
export const getClassById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cls = await Class.findById(req.params.id)
      .populate("academicYear", "name startDate endDate")
      .populate("adviser", "name email")
      .populate("students", "name email")
      .populate("subjects", "name code");
    if (!cls) {
      res.status(404).json({ message: "Class not found" });
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
