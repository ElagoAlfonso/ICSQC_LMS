import mongoose, { Schema, Document } from "mongoose";

export interface IAnswer {
  questionIndex: number;
  answer: string;
  isCorrect?: boolean;
  pointsEarned?: number;
}

export interface ISubmission extends Document {
  exam: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  answers: IAnswer[];
  score: number;
  totalPoints: number;
  percentage: number;
  isPassed: boolean;
  submittedAt: Date;
  gradedAt?: Date;
  gradedBy?: mongoose.Types.ObjectId;
  status: "submitted" | "graded" | "pending";
  feedback?: string;
  timeSpent?: number; // in seconds
}

const answerSchema = new Schema<IAnswer>({
  questionIndex: { type: Number, required: true },
  answer: { type: String, required: true },
  isCorrect: { type: Boolean },
  pointsEarned: { type: Number, default: 0 },
});

const submissionSchema = new Schema<ISubmission>(
  {
    exam: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    answers: [answerSchema],
    score: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    isPassed: { type: Boolean, default: false },
    submittedAt: { type: Date, default: Date.now },
    gradedAt: { type: Date },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["submitted", "graded", "pending"], default: "submitted" },
    feedback: { type: String },
    timeSpent: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model<ISubmission>("Submission", submissionSchema);
