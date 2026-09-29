import express from "express";
import { createRubric, getRubrics } from "../controllers/rubric";
import { authorize, protect } from "../middleware/auth";

const router = express.Router();

router.get("/", protect, authorize(["teacher", "admin"]), getRubrics);
router.post("/", protect, authorize(["teacher", "admin"]), createRubric);

export default router;