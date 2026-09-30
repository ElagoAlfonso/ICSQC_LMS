import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { MAX_ATTACHMENT_SIZE, MAX_ATTACHMENTS_PER_POST } from "../utils/attachments.ts";

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_SIZE, files: MAX_ATTACHMENTS_PER_POST },
});

const profilePhotoParser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
});

export const parseSubjectAttachments = (req: Request, res: Response, next: NextFunction) => {
  parser.array("attachments", MAX_ATTACHMENTS_PER_POST)(req, res, (error: any) => {
    if (!error) { next(); return; }
    if (error.code === "LIMIT_FILE_SIZE") { res.status(413).json({ message: "File exceeds the maximum allowed upload size." }); return; }
    if (error.code === "LIMIT_FILE_COUNT") { res.status(400).json({ message: `You can attach up to ${MAX_ATTACHMENTS_PER_POST} files per post.` }); return; }
    res.status(400).json({ message: `Upload failed: ${error.message}` });
  });
};

export const parseClassworkAttachments = parseSubjectAttachments;

export const parseGroupPhoto = (req: Request, res: Response, next: NextFunction) => {
  parser.single("groupPhoto")(req, res, (error: any) => {
    if (!error) { next(); return; }
    if (error.code === "LIMIT_FILE_SIZE") { res.status(413).json({ message: "File exceeds the maximum allowed upload size." }); return; }
    if (error.code === "LIMIT_UNEXPECTED_FILE") { res.status(400).json({ message: "Group photo must be an image." }); return; }
    res.status(400).json({ message: `Upload failed: ${error.message}` });
  });
};

export const parseProfilePhoto = (req: Request, res: Response, next: NextFunction) => {
  profilePhotoParser.single("profileImage")(req, res, (error: any) => {
    if (!error) { next(); return; }
    if (error.code === "LIMIT_FILE_SIZE") { res.status(413).json({ message: "Profile photo must be 4 MB or smaller." }); return; }
    if (error.code === "LIMIT_UNEXPECTED_FILE") { res.status(400).json({ message: "Upload one profile photo at a time." }); return; }
    res.status(400).json({ message: "Profile photo upload failed." });
  });
};
