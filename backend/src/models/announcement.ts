import mongoose, { Schema, Document } from "mongoose";

export interface IAttachment {
  originalName: string;
  storageName: string;
  storagePath: string;
  extension: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

export interface IAnnouncement extends Document {
  title: string;
  content: string;
  author: mongoose.Types.ObjectId;
  subject?: mongoose.Types.ObjectId;
  attachments: IAttachment[];
  targetRole: "all" | "student" | "teacher" | "admin";
  targetUsers?: mongoose.Types.ObjectId[];
  targetClass?: mongoose.Types.ObjectId;
  academicYear?: mongoose.Types.ObjectId;
  isPinned: boolean;
  isActive: boolean;
  expiresAt?: Date;
}

export const HIGH_SCHOOL_GRADE_LEVELS = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"]; 

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject" },
    attachments: [{
      originalName: { type: String, required: true },
      storageName: { type: String, required: true },
      storagePath: { type: String, required: true },
      extension: { type: String, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true },
      createdAt: { type: Date, default: Date.now },
    }],
    targetRole: {
      type: String,
      enum: ["all", "student", "teacher", "admin"],
      default: "all",
    },
    targetUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    targetClass: { type: Schema.Types.ObjectId, ref: "Class" },
    academicYear: { type: Schema.Types.ObjectId, ref: "AcademicYear" },
    isPinned: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IAnnouncement>("Announcement", announcementSchema);
