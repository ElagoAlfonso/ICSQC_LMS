import mongoose, { Schema, Document } from "mongoose";

export interface ISubjectGrade {
  subject: mongoose.Types.ObjectId;
  subjectName: string;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  finalGrade: number;
  remarks: "Passed" | "Failed" | "Incomplete";
}

export interface IReportCard extends Document {
  student: mongoose.Types.ObjectId;
  class: mongoose.Types.ObjectId;
  academicYear: mongoose.Types.ObjectId;
  period: "Q1" | "Q2" | "Q3" | "Q4" | "Final";
  subjectGrades: ISubjectGrade[];
  generalAverage: number;
  overallRemarks: string;
  attendance: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    tardyDays: number;
  };
  generatedAt: Date;
  generatedBy: mongoose.Types.ObjectId;
}

const subjectGradeSchema = new Schema<ISubjectGrade>({
  subject: { type: Schema.Types.ObjectId, ref: "Subject" },
  subjectName: { type: String, required: true },
  q1: { type: Number, default: 0 },
  q2: { type: Number, default: 0 },
  q3: { type: Number, default: 0 },
  q4: { type: Number, default: 0 },
  finalGrade: { type: Number, default: 0 },
  remarks: { type: String, enum: ["Passed", "Failed", "Incomplete"], default: "Incomplete" },
});

const reportCardSchema = new Schema<IReportCard>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    period: { type: String, enum: ["Q1", "Q2", "Q3", "Q4", "Final"], required: true },
    subjectGrades: [subjectGradeSchema],
    generalAverage: { type: Number, default: 0 },
    overallRemarks: { type: String, default: "" },
    attendance: {
      totalDays: { type: Number, default: 0 },
      presentDays: { type: Number, default: 0 },
      absentDays: { type: Number, default: 0 },
      tardyDays: { type: Number, default: 0 },
    },
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model<IReportCard>("ReportCard", reportCardSchema);
