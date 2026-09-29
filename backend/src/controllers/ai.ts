import type { Response } from "express";
import Class from "../models/class.ts";
import Subject from "../models/subject.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import { generateTutorReply, type AiContext } from "../services/ai.service.ts";
import { canUseAI } from "../services/aiAccess.service.ts";

const getAiContext = async (req: AuthRequest): Promise<AiContext> => {
  const user = req.user;
  if (!user) return {};

  const [classDoc, subjectDocs] = await Promise.all([
    user.studentClass ? Class.findById(user.studentClass).select("name section") : null,
    user.role === "teacher" ? Subject.find({ teacher: user._id }).select("name code").sort({ name: 1 }) : [],
  ]);

  const subjectName = subjectDocs.length > 0
    ? subjectDocs.map((subject) => `${subject.name}${subject.code ? ` (${subject.code})` : ""}`).join(", ")
    : undefined;

  return {
    name: user.name,
    role: user.role,
    className: classDoc ? `${classDoc.name}${classDoc.section ? ` - ${classDoc.section}` : ""}` : undefined,
    subjectName,
  };
};

export const chat = async (req: AuthRequest, res: Response): Promise<void> => {
  const { message, conversationHistory } = req.body as {
    message?: unknown;
    conversationHistory?: unknown;
  };

  if (typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ success: false, message: "Message is required" });
    return;
  }

  if (message.length > 4000) {
    res.status(400).json({ success: false, message: "Message must be 4000 characters or fewer" });
    return;
  }

  try {
    const access = await canUseAI(req.user);
    if (!access.allowed) {
      res.status(403).json({ success: false, message: access.message });
      return;
    }

    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
      res.status(503).json({ success: false, message: "AI service is not configured" });
      return;
    }

    const history = Array.isArray(conversationHistory)
      ? conversationHistory.filter((item): item is { role: "user" | "assistant"; content: string } =>
          !!item && typeof item === "object" &&
          ((item as { role?: unknown }).role === "user" || (item as { role?: unknown }).role === "assistant") &&
          typeof (item as { content?: unknown }).content === "string" &&
          (item as { content: string }).content.length <= 4000,
        ).slice(-10)
      : [];

    let context: AiContext | undefined;
    try {
      context = await getAiContext(req);
    } catch {
      console.warn("AI context could not be loaded; continuing without LMS context.");
    }

    const reply = await generateTutorReply(message.trim(), history, context);
    res.json({ success: true, reply, message: reply });
  } catch {
    console.error("AI API request failed.");
    res.status(502).json({ success: false, message: "The AI service is temporarily unavailable" });
  }
};

export const getAccess = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const access = await canUseAI(req.user);
    res.status(200).json({ success: true, ...access });
  } catch {
    console.error("AI access check failed.");
    res.status(503).json({ success: false, message: "AI access could not be verified" });
  }
};
