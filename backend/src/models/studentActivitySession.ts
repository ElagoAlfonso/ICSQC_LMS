import mongoose, { Schema, Document } from "mongoose";

export interface IStudentActivitySession extends Document {
  student: mongoose.Types.ObjectId;
  classwork: mongoose.Types.ObjectId;
  startedAt: Date;
}

const studentActivitySessionSchema = new Schema<IStudentActivitySession>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    classwork: { type: Schema.Types.ObjectId, ref: "Classwork", required: true },
    startedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true },
);

studentActivitySessionSchema.index({ student: 1, classwork: 1 }, { unique: true });

export default mongoose.model<IStudentActivitySession>("StudentActivitySession", studentActivitySessionSchema);