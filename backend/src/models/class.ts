import mongoose, { Schema, Document } from "mongoose";

export interface IClass extends Document {
  name: string;
  section: string;
  gradeLevel: string;
  academicYear: mongoose.Types.ObjectId;
  adviser: mongoose.Types.ObjectId;
  students: mongoose.Types.ObjectId[];
  subjects: mongoose.Types.ObjectId[];
  isActive: boolean;
}

const classSchema = new Schema<IClass>(
  {
    name: { type: String, required: true },
    section: { type: String, required: true },
    gradeLevel: { type: String, required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    adviser: { type: Schema.Types.ObjectId, ref: "User" },
    students: [{ type: Schema.Types.ObjectId, ref: "User" }],
    subjects: [{ type: Schema.Types.ObjectId, ref: "Subject" }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IClass>("Class", classSchema);
