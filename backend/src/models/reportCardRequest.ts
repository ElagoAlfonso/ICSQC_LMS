import mongoose, { Schema, type Document } from "mongoose";

export interface IReportCardRequest extends Document {
  teacher: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  class?: mongoose.Types.ObjectId;
  academicYear?: mongoose.Types.ObjectId;
  period: string;
  status: "pending" | "generated" | "sent" | "received";
  requestedAt: Date;
  generatedBy?: mongoose.Types.ObjectId;
  generatedAt?: Date;
  sentToTeacher?: mongoose.Types.ObjectId;
  sentAt?: Date;
  reportCard?: mongoose.Types.ObjectId;
  notes?: string;
}

const reportCardRequestSchema = new Schema<IReportCardRequest>(
  {
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    class: { type: Schema.Types.ObjectId, ref: "Class" },
    academicYear: { type: Schema.Types.ObjectId, ref: "AcademicYear" },
    period: { type: String, enum: ["Q1", "Q2", "Q3", "Q4", "Final"], required: true },
    status: { type: String, enum: ["pending", "generated", "sent", "received"], default: "pending" },
    requestedAt: { type: Date, default: Date.now },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    generatedAt: { type: Date },
    sentToTeacher: { type: Schema.Types.ObjectId, ref: "User" },
    sentAt: { type: Date },
    reportCard: { type: Schema.Types.ObjectId, ref: "ReportCard" },
    notes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IReportCardRequest>("ReportCardRequest", reportCardRequestSchema);
