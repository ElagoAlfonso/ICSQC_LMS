import express from "express";
import { createRubric, getRubrics } from "../controllers/rubric.ts";
import { authorize, protect } from "../middleware/auth.ts";

const router = express.Router();

router.get("/", protect, authorize(["teacher", "admin"]), getRubrics);
router.post("/", protect, authorize(["teacher", "admin"]), createRubric);

export default router;