import mongoose, { Schema, Document } from "mongoose";

export interface ISubmissionAttachment {
  originalName: string;
  storageName: string;
  storagePath: string;
  extension: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

export type SubmissionStatus = "submitted" | "graded" | "pending" | "missing" | "late";

export interface IClassworkSubmission extends Document {
  // Relationships
  classwork: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  class: mongoose.Types.ObjectId;
  subject: mongoose.Types.ObjectId;

  // Submission Content
  attachments: ISubmissionAttachment[];
  submittedNotes?: string;
  submittedAt: Date;
  isLate: boolean;

  // Grading
  score?: number;
  totalPoints: number;
  percentage?: number;
  feedback?: string;
  rubricScores?: Array<{ criterionId: string; score: number }>;
  gradedAt?: Date;
  gradedBy?: mongoose.Types.ObjectId;
  status: SubmissionStatus;

  // Revision tracking
  revisionCount: number;
  lastRevisedAt?: Date;
}

const submissionAttachmentSchema = new Schema<ISubmissionAttachment>({
  originalName: { type: String, required: true },
  storageName: { type: String, required: true },
  storagePath: { type: String, required: true },
  extension: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const classworkSubmissionSchema = new Schema<IClassworkSubmission>(
  {
    classwork: { type: Schema.Types.ObjectId, ref: "Classwork", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    attachments: [submissionAttachmentSchema],
    submittedNotes: { type: String },
    submittedAt: { type: Date, default: Date.now },
    isLate: { type: Boolean, default: false },
    score: { type: Number },
    totalPoints: { type: Number, required: true },
    percentage: { type: Number },
    feedback: { type: String },
    rubricScores: [{ criterionId: { type: String, required: true }, score: { type: Number, required: true, min: 0 } }],
    gradedAt: { type: Date },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["submitted", "graded", "pending", "missing", "late"],
      default: "submitted",
    },
    revisionCount: { type: Number, default: 1 },
    lastRevisedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IClassworkSubmission>("ClassworkSubmission", classworkSubmissionSchema);
