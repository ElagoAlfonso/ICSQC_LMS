import { type Request, type Response } from "express";
import { logActivity } from "../utils/activitieslog";
import AcademicYear from "../models/academicYear";
import { type AuthRequest } from "../middleware/auth";

// @desc     Create a new Academic Year
// @route    POST /api/academicYear
// @access   Private (Admin & Teacher only) 

export const createAcademicYear = async (
    req: AuthRequest, 
    res: Response
): Promise<void> => {
    try {
        const { name, startDate, endDate, isCurrent } = req.body;
        const existingYear = await AcademicYear.findOne({ startDate, endDate });

        if (existingYear) {
            res.status(400).json({ message: "Academic Year already exists" });
            return;
        }

        if (isCurrent) {
            await AcademicYear.updateMany(
                {_id: { $ne: null } }, 
                { isCurrent: false }
            );
        }
        const academicYear = await AcademicYear.create({
            name,
            startDate,
            endDate,
            isCurrent: isCurrent || false,
        });

        await logActivity({ 
            userId: req.user!._id, 
            action: "CREATE_ACADEMIC_YEAR",
            details: `Created academic year ${name}` 
        });

        res.status(201).json(academicYear);
    }catch(error){
        res.status(500).json({ message: "Server Error", error});
    } 
}

// @desc     Get all Academic Years
// @route    GET /api/academicYear
// @access   Private (Admin & Teacher only)

export const getAllAcademicYears = async (
    req: AuthRequest, 
    res: Response
): Promise<void> => {
    try {
        const academicYears = await AcademicYear.find({});
        res.status(200).json(academicYears);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
}

