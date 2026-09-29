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

export interface IResourceLink {
  title: string;
  url: string;
}

export type ClassworkType = "assignment" | "activity" | "assessment" | "syllabus" | "lesson" | "asynchronous" | "performance_task";
export type ClassworkStatus = "draft" | "scheduled" | "published" | "closed";
export type ClassworkSubmissionMode = "response" | "mark_done";

export interface IClasswork extends Document {
  // Basic Info
  title: string;
  description: string;
  type: ClassworkType; // assignment, activity, assessment
  submissionMode: ClassworkSubmissionMode;
  status: ClassworkStatus; // draft, scheduled, published, closed

  // Relationships
  class: mongoose.Types.ObjectId;
  subject: mongoose.Types.ObjectId;
  exam?: mongoose.Types.ObjectId;
  rubric?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId; // Teacher
  academicYear: mongoose.Types.ObjectId;

  // Submission Details
  instructions?: string;
  attachments: IAttachment[];
  resourceLinks: IResourceLink[];
  dueDate?: Date;
  dueTime?: string;
  points: number;
  allowLateSubmission: boolean;
  questions?: Array<{
    question: string;
    type: string;
    choices?: string[];
    correctAnswer?: string;
    points: number;
  }>;

  // Scheduling
  publishedAt?: Date;
  scheduledPublishDate?: Date;
  scheduledPublishTime?: string;
  closedAt?: Date;

  // Tracking
  totalSubmissions?: number;
  gradedSubmissions?: number;
}

const attachmentSchema = new Schema<IAttachment>({
  originalName: { type: String, required: true },
  storageName: { type: String, required: true },
  storagePath: { type: String, required: true },
  extension: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const classworkSchema = new Schema<IClasswork>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: {
      type: String,
      enum: ["assignment", "activity", "assessment", "syllabus", "lesson", "asynchronous", "performance_task"],
      required: true,
    },
    submissionMode: { type: String, enum: ["response", "mark_done"], default: "response" },
    status: {
      type: String,
      enum: ["draft", "scheduled", "published", "closed"],
      default: "draft",
    },
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    exam: { type: Schema.Types.ObjectId, ref: "Exam" },
    rubric: { type: Schema.Types.ObjectId, ref: "Rubric" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    instructions: { type: String },
    attachments: [attachmentSchema],
    resourceLinks: [{
      title: { type: String, required: true },
      url: { type: String, required: true },
    }],
    dueDate: { type: Date },
    dueTime: { type: String },
    points: { type: Number, default: 0 },
    allowLateSubmission: { type: Boolean, default: false },
    questions: [{
      question: { type: String, required: true },
      type: { type: String, required: true },
      choices: [{ type: String }],
      correctAnswer: { type: String },
      points: { type: Number, default: 1 },
    }],
    publishedAt: { type: Date },
    scheduledPublishDate: { type: Date },
    scheduledPublishTime: { type: String },
    closedAt: { type: Date },
    totalSubmissions: { type: Number, default: 0 },
    gradedSubmissions: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IClasswork>("Classwork", classworkSchema);
