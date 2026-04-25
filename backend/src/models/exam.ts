import mongoose, { Schema, Document } from "mongoose";

export interface IQuestion {
  question: string;
  type: "multiple_choice" | "true_false" | "short_answer" | "essay";
  choices?: string[];
  correctAnswer: string;
  points: number;
}

export interface IExam extends Document {
  title: string;
  description?: string;
  subject: mongoose.Types.ObjectId;
  class: mongoose.Types.ObjectId;
  academicYear: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  questions: IQuestion[];
  totalPoints: number;
  duration: number; // in minutes
  startDate: Date;
  endDate: Date;
  examType: "quiz" | "periodical" | "midterm" | "finals" | "assignment";
  status: "draft" | "published" | "closed";
  passingScore: number;
}

const questionSchema = new Schema<IQuestion>({
  question: { type: String, required: true },
  type: {
    type: String,
    enum: ["multiple_choice", "true_false", "short_answer", "essay"],
    required: true,
  },
  choices: [{ type: String }],
  correctAnswer: { type: String, required: true },
  points: { type: Number, default: 1 },
});

const examSchema = new Schema<IExam>(
  {
    title: { type: String, required: true },
    description: { type: String },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    questions: [questionSchema],
    totalPoints: { type: Number, default: 0 },
    duration: { type: Number, default: 60 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    examType: {
      type: String,
      enum: ["quiz", "periodical", "midterm", "finals", "assignment"],
      required: true,
    },
    status: { type: String, enum: ["draft", "published", "closed"], default: "draft" },
    passingScore: { type: Number, default: 75 },
  },
  { timestamps: true }
);

examSchema.pre("save", function () {
  this.totalPoints = this.questions.reduce((sum, q) => sum + (q.points || 1), 0);
});

export default mongoose.model<IExam>("Exam", examSchema);
