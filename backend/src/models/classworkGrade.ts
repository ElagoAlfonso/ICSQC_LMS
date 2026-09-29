import mongoose, { Schema, Document } from "mongoose";

export interface IClassworkGrade extends Document {
  classwork: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  class: mongoose.Types.ObjectId;
  subject: mongoose.Types.ObjectId;
  score: number;
  totalPoints: number;
  percentage: number;
  feedback?: string;
  rubricScores?: Array<{ criterionId: string; score: number }>;
  gradedBy: mongoose.Types.ObjectId;
  gradedAt: Date;
}

const classworkGradeSchema = new Schema<IClassworkGrade>(
  {
    classwork: { type: Schema.Types.ObjectId, ref: "Classwork", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    score: { type: Number, required: true, min: 0 },
    totalPoints: { type: Number, required: true, min: 0 },
    percentage: { type: Number, required: true, min: 0 },
    feedback: { type: String, default: "" },
    rubricScores: [{ criterionId: { type: String, required: true }, score: { type: Number, required: true, min: 0 } }],
    gradedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    gradedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

classworkGradeSchema.index({ classwork: 1, student: 1 }, { unique: true });

export default mongoose.model<IClassworkGrade>("ClassworkGrade", classworkGradeSchema);