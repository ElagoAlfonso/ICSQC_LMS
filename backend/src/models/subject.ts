import mongoose, { Schema, Document } from "mongoose";

export const HIGH_SCHOOL_GRADE_LEVELS = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

export interface ISubject extends Document {
  name: string;
  code: string;
  description?: string;
  teacher: mongoose.Types.ObjectId;
  gradeLevel: string;
  academicYear: mongoose.Types.ObjectId;
  units: number;
  isActive: boolean;
}

const subjectSchema = new Schema<ISubject>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true },
    description: { type: String },
    teacher: { type: Schema.Types.ObjectId, ref: "User" },
    gradeLevel: { type: String, required: true, enum: HIGH_SCHOOL_GRADE_LEVELS },
    academicYear: { type: Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    units: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<ISubject>("Subject", subjectSchema);
