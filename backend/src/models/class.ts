import mongoose, { Schema, Document } from "mongoose";

export const HIGH_SCHOOL_GRADE_LEVELS = ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];

export interface IClass extends Document {
  name: string;
  section: string;
  gradeLevel: string;
  academicYear: mongoose.Types.ObjectId;
  adviser: mongoose.Types.ObjectId;
  coTeachers: mongoose.Types.ObjectId[];
  students: mongoose.Types.ObjectId[];
  subjects: mongoose.Types.ObjectId[];
  inviteCode?: string;
  inviteExpiresAt?: Date | null;
  maxStudents?: number | null;
  approvalStatus?: "pending" | "approved" | "rejected";
  createdBy?: mongoose.Types.ObjectId;
  rejectedReason?: string;
  isActive: boolean;
}

const classSchema = new Schema<IClass>(
  {
    name: { type: String, required: true },
    section: { type: String, required: true },
    gradeLevel: { type: String, required: true, enum: HIGH_SCHOOL_GRADE_LEVELS },
    academicYear: { type: Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    adviser: { type: Schema.Types.ObjectId, ref: "User" },
    coTeachers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    students: [{ type: Schema.Types.ObjectId, ref: "User" }],
    subjects: [{ type: Schema.Types.ObjectId, ref: "Subject" }],
    inviteCode: { type: String, unique: true, sparse: true },
    inviteExpiresAt: { type: Date, default: null },
    maxStudents: { type: Number, default: null },
    approvalStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectedReason: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

classSchema.pre("save", function () {
  if (!this.inviteCode) {
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    this.inviteCode = `ICS-${random}`;
  }
});

export default mongoose.model<IClass>("Class", classSchema);
