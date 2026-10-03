import type { AuthRequest } from "../middleware/auth.ts";
import ExamAttempt from "../models/examAttempt.ts";
import Classwork from "../models/classwork.ts";
import StudentActivitySession from "../models/studentActivitySession.ts";

export const AI_EXAM_RESTRICTED_MESSAGE = "The AI Reviewer is not available while you are taking an exam. You can use it again after you have completed or submitted your exam.";
export const AI_CLASSWORK_RESTRICTED_MESSAGE = "The AI Reviewer is not available while you are completing this schoolwork. You can use it again after you have submitted your work.";
export const AI_RESTRICTED_MESSAGE = AI_EXAM_RESTRICTED_MESSAGE;

export const canUseAI = async (user: AuthRequest["user"]): Promise<{ allowed: boolean; message?: string }> => {
  if (!user) {
    return { allowed: false, message: "Not authorized" };
  }

  if (user.role === "student") {
    const now = new Date();
    const activeExam = await ExamAttempt.exists({
      student: user._id,
      status: "in_progress",
      deadline: { $gt: now },
    });
    if (activeExam) {
      return { allowed: false, message: AI_EXAM_RESTRICTED_MESSAGE };
    }

    const activeClassworkSessions = await StudentActivitySession.find({ student: user._id }).select("classwork").lean();
    if (activeClassworkSessions.length > 0) {
      const activeClasswork = await Classwork.exists({
        _id: { $in: activeClassworkSessions.map((session) => session.classwork) },
        status: "published",
        type: { $nin: ["syllabus", "lesson"] },
      });
      if (activeClasswork) {
        return { allowed: false, message: AI_CLASSWORK_RESTRICTED_MESSAGE };
      }
    }
  }

  return { allowed: true };
};