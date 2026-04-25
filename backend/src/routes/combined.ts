import express from "express";
import { protect, authorize } from "../middleware/auth";
import {
  createExam, getExams, getExamById, updateExam, deleteExam, publishExam, closeExam,
  submitExam, getSubmissions, getMySubmissions, gradeSubmission,
  createAnnouncement, getAnnouncements, updateAnnouncement, deleteAnnouncement,
  getDashboardStats,
  getTimetable, createOrUpdateTimetable,
  generateReportCard, getStudentReportCards, getAllReportCards,
  getAnalytics,
} from "../controllers/combined";
import { createClass, getClasses, getClassById, updateClass, deleteClass, addStudentToClass } from "../controllers/class";
import { createSubject, getSubjects, getSubjectById, updateSubject, deleteSubject } from "../controllers/subject";
import { createAcademicYear, getAllAcademicYears } from "../controllers/academicYear";

const router = express.Router();

// ── Academic Year extra routes ────────────────────────────────────────────
router.put("/academicYear/:id", protect, authorize(["admin"]), async (req, res) => {
  const AcademicYear = (await import("../models/academicYear")).default;
  try {
    const ay = await AcademicYear.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!ay) { res.status(404).json({ message: "Not found" }); return; }
    res.json(ay);
  } catch { res.status(500).json({ message: "Error" }); }
});

router.delete("/academicYear/:id", protect, authorize(["admin"]), async (req, res) => {
  const AcademicYear = (await import("../models/academicYear")).default;
  try {
    await AcademicYear.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch { res.status(500).json({ message: "Error" }); }
});

router.patch("/academicYear/:id/current", protect, authorize(["admin"]), async (req, res) => {
  const AcademicYear = (await import("../models/academicYear")).default;
  try {
    await AcademicYear.updateMany({}, { isCurrent: false });
    const ay = await AcademicYear.findByIdAndUpdate(req.params.id, { isCurrent: true }, { new: true });
    res.json(ay);
  } catch { res.status(500).json({ message: "Error" }); }
});

// ── Classes ───────────────────────────────────────────────────────────────
router.get("/classes", protect, getClasses);
router.get("/classes/:id", protect, getClassById);
router.post("/classes", protect, authorize(["admin"]), createClass);
router.put("/classes/:id", protect, authorize(["admin"]), updateClass);
router.delete("/classes/:id", protect, authorize(["admin"]), deleteClass);
router.post("/classes/:id/students", protect, authorize(["admin"]), addStudentToClass);

// ── Subjects ─────────────────────────────────────────────────────────────
router.get("/subjects", protect, getSubjects);
router.get("/subjects/:id", protect, getSubjectById);
router.post("/subjects", protect, authorize(["admin", "teacher"]), createSubject);
router.put("/subjects/:id", protect, authorize(["admin", "teacher"]), updateSubject);
router.delete("/subjects/:id", protect, authorize(["admin"]), deleteSubject);

// ── Exams ─────────────────────────────────────────────────────────────────
router.get("/exams", protect, getExams);
router.get("/exams/:id", protect, getExamById);
router.post("/exams", protect, authorize(["admin", "teacher"]), createExam);
router.put("/exams/:id", protect, authorize(["admin", "teacher"]), updateExam);
router.delete("/exams/:id", protect, authorize(["admin", "teacher"]), deleteExam);
router.patch("/exams/:id/publish", protect, authorize(["admin", "teacher"]), publishExam);
router.patch("/exams/:id/close", protect, authorize(["admin", "teacher"]), closeExam);

// ── Submissions ───────────────────────────────────────────────────────────
router.get("/submissions", protect, authorize(["admin", "teacher"]), getSubmissions);
router.get("/submissions/mine", protect, getMySubmissions);
router.post("/submissions", protect, authorize(["student"]), submitExam);
router.patch("/submissions/:id/grade", protect, authorize(["admin", "teacher"]), gradeSubmission);

// ── Announcements ─────────────────────────────────────────────────────────
router.get("/announcements", protect, getAnnouncements);
router.post("/announcements", protect, authorize(["admin", "teacher"]), createAnnouncement);
router.put("/announcements/:id", protect, authorize(["admin", "teacher"]), updateAnnouncement);
router.delete("/announcements/:id", protect, authorize(["admin"]), deleteAnnouncement);

// ── Dashboard ─────────────────────────────────────────────────────────────
router.get("/dashboard/stats", protect, authorize(["admin"]), getDashboardStats);
router.get("/analytics", protect, authorize(["admin"]), getAnalytics);

// ── Timetable ─────────────────────────────────────────────────────────────
router.get("/timetable/:classId", protect, getTimetable);
router.post("/timetable", protect, authorize(["admin", "teacher"]), createOrUpdateTimetable);
router.put("/timetable/:id", protect, authorize(["admin", "teacher"]), createOrUpdateTimetable);

// ── Report Cards ──────────────────────────────────────────────────────────
router.get("/reportcards", protect, authorize(["admin", "teacher"]), getAllReportCards);
router.get("/reportcards/student/:studentId", protect, getStudentReportCards);
router.post("/reportcards/generate", protect, authorize(["admin", "teacher"]), generateReportCard);

export default router;
