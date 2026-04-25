import { type Request, type Response } from "express";
import ActivityLog from "../models/activitieslog";

// @desc    Get System Activity Log with search + pagination
// @route   GET /api/activitieslog
// @access  Private (Admin & Teacher only)
export const getAllActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 15;
    const skip  = (page - 1) * limit;
    const search = req.query.search as string;

    const filter: any = {};
    if (search) {
      filter.$or = [
        { action:  { $regex: search, $options: "i" } },
        { details: { $regex: search, $options: "i" } },
      ];
    }

    const [total, logs] = await Promise.all([
      ActivityLog.countDocuments(filter),
      ActivityLog.find(filter)
        .populate("user", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    res.json({
      logs,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};
