import mongoose, { Schema, Document } from "mongoose";

export interface IAnnouncement extends Document {
  title: string;
  content: string;
  author: mongoose.Types.ObjectId;
  targetRole: "all" | "student" | "teacher" | "admin";
  targetClass?: mongoose.Types.ObjectId;
  academicYear?: mongoose.Types.ObjectId;
  isPinned: boolean;
  isActive: boolean;
  expiresAt?: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetRole: {
      type: String,
      enum: ["all", "student", "teacher", "admin"],
      default: "all",
    },
    targetClass: { type: Schema.Types.ObjectId, ref: "Class" },
    academicYear: { type: Schema.Types.ObjectId, ref: "AcademicYear" },
    isPinned: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IAnnouncement>("Announcement", announcementSchema);
