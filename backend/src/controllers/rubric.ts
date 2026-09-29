import { randomUUID } from "node:crypto";
import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth.ts";
import Rubric from "../models/rubric.ts";

export const getRubrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rubrics = await Rubric.find({ createdBy: req.user?._id }).sort({ updatedAt: -1 }).lean();
    res.status(200).json({ rubrics });
  } catch (error) {
    console.error("Error fetching rubrics:", error);
    res.status(500).json({ message: "Unable to load rubrics." });
  }
};

export const createRubric = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const inputCriteria = req.body.criteria;
    if (!name || name.length > 120 || !Array.isArray(inputCriteria) || inputCriteria.length < 1 || inputCriteria.length > 20) {
      res.status(400).json({ message: "Provide a rubric name and between 1 and 20 criteria." });
      return;
    }

    const criteria = inputCriteria.map((criterion: any) => ({
      id: randomUUID(),
      title: typeof criterion.title === "string" ? criterion.title.trim() : "",
      description: typeof criterion.description === "string" ? criterion.description.trim() : "",
      maxPoints: Number(criterion.maxPoints),
    }));
    if (criteria.some((criterion: { title: string; description: string; maxPoints: number }) =>
      !criterion.title || criterion.title.length > 120 || criterion.description.length > 500 || !Number.isFinite(criterion.maxPoints) || criterion.maxPoints < 0 || criterion.maxPoints > 10000
    )) {
      res.status(400).json({ message: "Each criterion needs a title and a valid non-negative point value." });
      return;
    }

    const rubric = await Rubric.create({ name, criteria, createdBy: req.user?._id });
    res.status(201).json({ rubric });
  } catch (error) {
    console.error("Error creating rubric:", error);
    res.status(500).json({ message: "Unable to create rubric." });
  }
};