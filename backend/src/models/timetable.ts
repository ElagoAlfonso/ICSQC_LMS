import mongoose, { Schema, Document } from "mongoose";

export interface ITimeSlot {
  dayOfWeek: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";
  startTime: string; // "08:00"
  endTime: string;   // "09:00"
  subject: mongoose.Types.ObjectId;
  teacher: mongoose.Types.ObjectId;
  room?: string;
}

export interface ITimetable extends Document {
  class: mongoose.Types.ObjectId;
  academicYear: mongoose.Types.ObjectId;
  timeSlots: ITimeSlot[];
  createdBy: mongoose.Types.ObjectId;
}

const timeSlotSchema = new Schema<ITimeSlot>({
  dayOfWeek: {
    type: String,
    enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    required: true,
  },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
  teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
  room: { type: String },
});

const timetableSchema = new Schema<ITimetable>(
  {
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: "AcademicYear", required: true },
    timeSlots: [timeSlotSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model<ITimetable>("Timetable", timetableSchema);
