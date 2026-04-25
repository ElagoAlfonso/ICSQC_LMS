import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth";
import { logActivity } from "../utils/activitieslog";
import Subject from "../models/subject";

export const createSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, code, description, teacher, gradeLevel, academicYear, units } = req.body;
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
    const subject = await Subject.findById(req.params.id)
      .populate("teacher", "name email")
      .populate("academicYear", "name");
    if (!subject) {
      res.status(404).json({ message: "Subject not found" });
      return;
    }
    res.json(subject);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const updateSubject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      res.status(404).json({ message: "Subject not found" });
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
