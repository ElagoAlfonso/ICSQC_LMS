import mongoose, { Schema, Document } from "mongoose";

export interface IQuestionAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  isImage: boolean;
}

export interface IQuestion {
  question: string;
  type: "multiple_choice" | "true_false" | "short_answer" | "essay";
  choices?: string[];
  correctAnswer: string;
  points: number;
  image?: string | null;
  imageName?: string | null;
  attachments?: IQuestionAttachment[];
}

export type ExamStatus = "draft" | "scheduled" | "published" | "closed" | "archived";

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
  timeLimit?: number;
  randomizeQuestions: boolean;
  publishDate?: Date;
  publishTime?: string;
  startDate: Date;
  endDate: Date;
  examType: "quiz" | "periodical" | "midterm" | "finals" | "assignment" | "formative";
  status: ExamStatus;
  passingScore: number;
  allowLateSubmission?: boolean;
}

const attachmentSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String, required: true },
  isImage: { type: Boolean, default: false },
}, { _id: false });

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
  image: { type: String, default: null },
  imageName: { type: String, default: null },
  attachments: [attachmentSchema],
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
    timeLimit: { type: Number, default: 60 },
    randomizeQuestions: { type: Boolean, default: false },
    publishDate: { type: Date },
    publishTime: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    examType: {
      type: String,
      enum: ["quiz", "periodical", "midterm", "finals", "assignment", "formative"],
      required: true,
    },
    status: { type: String, enum: ["draft", "scheduled", "published", "closed", "archived"], default: "draft" },
    passingScore: { type: Number, default: 75 },
    allowLateSubmission: { type: Boolean, default: false },
  },
  { timestamps: true }
);

examSchema.pre("save", function () {
  this.totalPoints = this.questions.reduce((sum, q) => sum + (q.points || 1), 0);
  if (this.duration <= 0) {
    throw new Error("Exam duration must be greater than 0 minutes.");
  }
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    throw new Error("Exam end date and time must be on or after the start date and time.");
  }
});

export default mongoose.model<IExam>("Exam", examSchema);
