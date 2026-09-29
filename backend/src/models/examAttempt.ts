import mongoose, { Schema, Document } from "mongoose";

export type ExamAttemptStatus = "in_progress" | "submitted" | "expired";

export interface IExamAttempt extends Document {
  exam: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  startedAt: Date;
  deadline: Date;
  questionOrder: number[];
  submittedAt?: Date;
  status: ExamAttemptStatus;
}

const examAttemptSchema = new Schema<IExamAttempt>(
  {
    exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date, required: true },
    deadline: { type: Date, required: true },
    questionOrder: { type: [Number], required: true },
    submittedAt: { type: Date },
    status: { type: String, enum: ["in_progress", "submitted", "expired"], default: "in_progress" },
  },
  { timestamps: true },
);

examAttemptSchema.index({ exam: 1, student: 1 }, { unique: true });

export default mongoose.model<IExamAttempt>("ExamAttempt", examAttemptSchema);
