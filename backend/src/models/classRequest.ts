import mongoose, { Schema, Document } from "mongoose";

export interface IClassRequest extends Document {
  teacher: mongoose.Types.ObjectId;
  name: string;
  section: string;
  gradeLevel: string;
  academicYear: mongoose.Types.ObjectId;
  subject: mongoose.Types.ObjectId;
  status: "pending" | "approved" | "rejected";
  approvedBy?: mongoose.Types.ObjectId;
  rejectedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const classRequestSchema = new Schema<IClassRequest>(
  {
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    section: { type: String, required: true },
    gradeLevel: { type: String, required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectedReason: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model<IClassRequest>("ClassRequest", classRequestSchema);
