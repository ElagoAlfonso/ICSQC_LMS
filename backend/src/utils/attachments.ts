import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Express } from "express";

export const MAX_ATTACHMENT_SIZE = Number(process.env.MAX_ATTACHMENT_SIZE || 50 * 1024 * 1024);
export const MAX_ATTACHMENTS_PER_POST = 10;

const MIME_BY_EXTENSION: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword", "application/octet-stream"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/octet-stream"],
  ".ppt": ["application/vnd.ms-powerpoint", "application/octet-stream"],
  ".xls": ["application/vnd.ms-excel", "application/octet-stream"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/octet-stream"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip", "application/octet-stream"],
  ".txt": ["text/plain", "application/octet-stream"],
  ".md": ["text/markdown", "text/plain", "application/octet-stream"], ".json": ["application/json", "text/plain", "application/octet-stream"], ".xml": ["application/xml", "text/xml", "text/plain", "application/octet-stream"], ".rtf": ["application/rtf", "text/rtf", "application/octet-stream"], ".log": ["text/plain", "application/octet-stream"], ".ini": ["text/plain", "application/octet-stream"], ".cfg": ["text/plain", "application/octet-stream"],
  ".csv": ["text/csv", "application/csv", "text/plain", "application/octet-stream"],
  ".jpg": ["image/jpeg"], ".jpeg": ["image/jpeg"], ".png": ["image/png"], ".gif": ["image/gif"], ".bmp": ["image/bmp", "image/x-ms-bmp"], ".webp": ["image/webp"],
  ".mp3": ["audio/mpeg", "audio/mp3", "application/octet-stream"], ".wav": ["audio/wav", "audio/x-wav", "audio/wave", "application/octet-stream"],
  ".mp4": ["video/mp4", "application/octet-stream"], ".mov": ["video/quicktime", "video/mp4", "application/octet-stream"],
  ".zip": ["application/zip", "application/x-zip-compressed", "application/octet-stream"], ".rar": ["application/vnd.rar", "application/x-rar-compressed", "application/octet-stream"], ".7z": ["application/x-7z-compressed", "application/octet-stream"],
};

export const SUPPORTED_EXTENSIONS = Object.keys(MIME_BY_EXTENSION);

const hasPrefix = (buffer: Buffer, bytes: number[]) => bytes.every((byte, index) => buffer[index] === byte);
const hasAscii = (buffer: Buffer, value: string, offset = 0) => buffer.subarray(offset, offset + value.length).toString("ascii") === value;
const isUtf8Text = (buffer: Buffer) => {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, 512));
    return true;
  } catch {
    return false;
  }
};

const hasValidSignature = (extension: string, buffer: Buffer) => {
  if ([".txt", ".csv", ".md", ".json", ".xml", ".rtf", ".log", ".ini", ".cfg"].includes(extension)) {
    const sample = buffer.subarray(0, 512);
    return isUtf8Text(sample) && sample.every((byte) => byte === 9 || byte === 10 || byte === 13 || byte >= 32);
  }
  if ([".doc", ".xls", ".ppt"].includes(extension)) return hasPrefix(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if ([".docx", ".xlsx", ".pptx", ".zip"].includes(extension)) return hasPrefix(buffer, [0x50, 0x4b, 0x03, 0x04]) || hasPrefix(buffer, [0x50, 0x4b, 0x05, 0x06]);
  if (extension === ".pdf") return hasAscii(buffer, "%PDF");
  if ([".jpg", ".jpeg"].includes(extension)) return hasPrefix(buffer, [0xff, 0xd8, 0xff]);
  if (extension === ".png") return hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (extension === ".gif") return hasAscii(buffer, "GIF8");
  if (extension === ".bmp") return hasAscii(buffer, "BM");
  if (extension === ".webp") return hasAscii(buffer, "RIFF") && hasAscii(buffer, "WEBP", 8);
  if (extension === ".mp3") return hasAscii(buffer, "ID3") || (buffer[0] === 0xff && ((buffer[1] || 0) & 0xe0) === 0xe0);
  if (extension === ".wav") return hasAscii(buffer, "RIFF") && hasAscii(buffer, "WAVE", 8);
  if ([".mp4", ".mov"].includes(extension)) return hasAscii(buffer, "ftyp", 4);
  if (extension === ".rar") return hasAscii(buffer, "Rar!\x1a\x07");
  if (extension === ".7z") return hasPrefix(buffer, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]);
  return false;
};

export const validateAttachment = (file: Express.Multer.File) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!MIME_BY_EXTENSION[extension]) throw new Error(`Unsupported file type: ${extension || "unknown"}.`);
  if (file.size > MAX_ATTACHMENT_SIZE) throw new Error("File exceeds the maximum allowed upload size.");
  if (!MIME_BY_EXTENSION[extension].includes(file.mimetype)) throw new Error(`The MIME type for ${file.originalname} does not match its file extension.`);
  if (!hasValidSignature(extension, file.buffer)) throw new Error(`The file signature for ${file.originalname} is invalid or the file is corrupted.`);
  return extension;
};

export const saveAttachment = async (file: Express.Multer.File, extension: string) => {
  const directory = path.resolve(process.env.UPLOAD_DIR || "uploads/attachments");
  await fs.mkdir(directory, { recursive: true });
  const storageName = `${crypto.randomUUID()}${extension}`;
  const storagePath = path.join(directory, storageName);
  await fs.writeFile(storagePath, file.buffer, { flag: "wx" });
  return { storageName, storagePath };
};

export const removeStoredAttachment = async (storagePath: string) => {
  try { await fs.unlink(storagePath); } catch (error: any) { if (error.code !== "ENOENT") throw error; }
};
