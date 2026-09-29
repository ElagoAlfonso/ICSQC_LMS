import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.ts";
import Announcement from "../models/announcement.ts";
import Class from "../models/class.ts";
import ClassworkSubmission from "../models/classworkSubmission.ts";
import Classwork from "../models/classwork.ts";

export const downloadAnnouncementAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const announcement = await Announcement.findById(req.params.postId).select("author subject targetClass attachments");
    if (!announcement) { res.status(404).json({ message: "Post not found." }); return; }

    let allowed = req.user?.role === "admin";
    if (req.user?.role === "teacher") allowed = announcement.author.toString() === req.user._id.toString();
    if (req.user?.role === "student") {
      allowed = Boolean(await Class.exists({
        _id: announcement.targetClass,
        subjects: announcement.subject,
        students: req.user._id,
        isActive: true,
      }));
    }
    if (!allowed) { res.status(403).json({ message: "You are not authorized to access this attachment." }); return; }

    const attachment = announcement.attachments.find((item: any) => item._id.toString() === req.params.attachmentId);
    if (!attachment) { res.status(404).json({ message: "Attachment not found." }); return; }
    res.type(attachment.mimeType);
    const handleError = (error?: Error & { code?: string }) => {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (error && !res.headersSent) res.status(code === "ENOENT" ? 404 : 500).json({ message: code === "ENOENT" ? "Stored file not found." : "Unable to retrieve attachment." });
    };
    if (req.query.download === "1") {
      res.download(attachment.storagePath, attachment.originalName, { dotfiles: "deny" }, handleError);
    } else {
      res.sendFile(attachment.storagePath, { dotfiles: "deny", headers: { "Content-Disposition": `inline; filename="${attachment.originalName.replace(/[\"\r\n]+/g, "")}"` } }, handleError);
    }
  } catch { res.status(500).json({ message: "Unable to retrieve attachment." }); }
};

export const downloadClassworkSubmissionAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const submission = await ClassworkSubmission.findById(req.params.submissionId).select("student classwork class attachments");
    if (!submission) { res.status(404).json({ message: "Submission not found." }); return; }
    const isOwner = submission.student.toString() === req.user?._id.toString();
    const classwork = await (await import("../models/classwork.ts")).default.findById(submission.classwork).select("createdBy");
    const isTeacher = classwork?.createdBy.toString() === req.user?._id.toString();
    if (req.user?.role !== "admin" && !isOwner && !isTeacher) {
      res.status(403).json({ message: "You are not authorized to access this attachment." });
      return;
    }
    const attachment = submission.attachments.find((item: any) => item._id.toString() === req.params.attachmentId);
    if (!attachment) { res.status(404).json({ message: "Attachment not found." }); return; }
    res.type(attachment.mimeType);
    const handleError = (error?: Error & { code?: string }) => {
      if (error && !res.headersSent) res.status(error.code === "ENOENT" ? 404 : 500).json({ message: error.code === "ENOENT" ? "Stored file not found." : "Unable to retrieve attachment." });
    };
    if (req.query.download === "1") res.download(attachment.storagePath, attachment.originalName, { dotfiles: "deny" }, handleError);
    else res.sendFile(attachment.storagePath, { dotfiles: "deny", headers: { "Content-Disposition": `inline; filename="${attachment.originalName.replace(/["\r\n]+/g, "")}"` } }, handleError);
  } catch { res.status(500).json({ message: "Unable to retrieve attachment." }); }
};

export const downloadClassworkAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classwork = await Classwork.findById(req.params.classworkId).select("createdBy class status attachments");
    if (!classwork) { res.status(404).json({ message: "Classwork not found." }); return; }

    let allowed = req.user?.role === "admin";
    if (req.user?.role === "teacher") allowed = classwork.createdBy.toString() === req.user._id.toString();
    if (req.user?.role === "student" && classwork.status === "published") {
      const assignedClass = req.user.studentClass
        ? await Class.findById(req.user.studentClass).select("gradeLevel").lean()
        : null;
      allowed = Boolean(await Class.exists({
        _id: classwork.class,
        ...(assignedClass?.gradeLevel ? { gradeLevel: assignedClass.gradeLevel } : { students: req.user._id }),
      }));
    }
    if (!allowed) { res.status(403).json({ message: "You are not authorized to access this material." }); return; }

    const attachment = classwork.attachments.find((item: any) => item._id.toString() === req.params.attachmentId);
    if (!attachment) { res.status(404).json({ message: "Material not found." }); return; }
    res.type(attachment.mimeType);
    const handleError = (error?: Error & { code?: string }) => {
      if (error && !res.headersSent) res.status(error.code === "ENOENT" ? 404 : 500).json({ message: error.code === "ENOENT" ? "Stored material not found." : "Unable to retrieve material." });
    };
    if (req.query.download === "1") res.download(attachment.storagePath, attachment.originalName, { dotfiles: "deny" }, handleError);
    else res.sendFile(attachment.storagePath, { dotfiles: "deny", headers: { "Content-Disposition": `inline; filename="${attachment.originalName.replace(/["\r\n]+/g, "")}"` } }, handleError);
  } catch {
    res.status(500).json({ message: "Unable to retrieve material." });
  }
};
