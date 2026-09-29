import express from "express";
import {
  createClasswork,
  getClasswork,
  getClassworkById,
  updateClasswork,
  deleteClasswork,
  publishClasswork,
  closeClasswork,
  submitClasswork,
  getSubmissions,
  getClassworkGrades,
  saveClassworkGrade,
  getMyGrades,
  getMySubmissions,
  gradeSubmission,
} from "../controllers/classwork.ts";
import { authorize, protect } from "../middleware/auth.ts";
import { parseClassworkAttachments } from "../middleware/upload.ts";
import { downloadClassworkAttachment, downloadClassworkSubmissionAttachment } from "../controllers/attachment.ts";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
//  CLASSWORK CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

// Create classwork (Teacher/Admin only)
router.post("/", protect, authorize(["teacher", "admin"]), parseClassworkAttachments, createClasswork);

// Get all classwork (with filters)
router.get("/", protect, getClasswork);

// Get my submissions (Student)
router.get("/submissions/mine", protect, getMySubmissions);
router.get("/grades/mine", protect, authorize(["student"]), getMyGrades);

// Published lesson materials are served only to their class members.
router.get("/:classworkId/attachments/:attachmentId", protect, downloadClassworkAttachment);

// Get single classwork by ID
router.get("/:classworkId", protect, getClassworkById);

// Update classwork (Teacher/Admin only)
router.put("/:classworkId", protect, updateClasswork);

// Delete classwork (Teacher/Admin only)
router.delete("/:classworkId", protect, deleteClasswork);

// ═══════════════════════════════════════════════════════════════════════════
//  CLASSWORK PUBLISHING/SCHEDULING
// ═══════════════════════════════════════════════════════════════════════════

// Publish or schedule classwork
router.patch("/:classworkId/publish", protect, publishClasswork);

// Close classwork (stop accepting submissions)
router.patch("/:classworkId/close", protect, closeClasswork);

// ═══════════════════════════════════════════════════════════════════════════
//  SUBMISSIONS
// ═══════════════════════════════════════════════════════════════════════════

// Submit classwork (Student)
router.post("/:classworkId/submit", protect, parseClassworkAttachments, submitClasswork);
router.get("/submissions/:submissionId/attachments/:attachmentId", protect, downloadClassworkSubmissionAttachment);

// Get all submissions for a classwork (Teacher/Admin only)
router.get("/:classworkId/submissions", protect, getSubmissions);
router.get("/:classworkId/grades", protect, authorize(["teacher", "admin"]), getClassworkGrades);
router.put("/:classworkId/grades/:studentId", protect, authorize(["teacher", "admin"]), saveClassworkGrade);

// Grade a submission (Teacher/Admin only)
router.patch("/submissions/:submissionId/grade", protect, gradeSubmission);

export default router;
