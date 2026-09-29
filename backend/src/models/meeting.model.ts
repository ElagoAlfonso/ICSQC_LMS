import mongoose, { Document, Schema } from "mongoose";

export type MeetingStatus = "Scheduled" | "Live" | "Finished" | "Cancelled";

export interface IMeeting extends Document {
  teacherId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId;
  eventId: string;
  meetLink: string;
  meetingTitle: string;
  description?: string;
  startDateTime: Date;
  endDateTime: Date;
  status: MeetingStatus;
  createdAt: Date;
  updatedAt: Date;
}

const meetingSchema = new Schema<IMeeting>(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", index: true },
    eventId: { type: String, required: true, unique: true },
    meetLink: { type: String, required: true },
    meetingTitle: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    startDateTime: { type: Date, required: true, index: true },
    endDateTime: { type: Date, required: true },
    status: { type: String, enum: ["Scheduled", "Live", "Finished", "Cancelled"], default: "Scheduled", index: true },
  },
  { timestamps: true }
);

meetingSchema.index({ classId: 1, startDateTime: 1, endDateTime: 1 });

export default mongoose.model<IMeeting>("Meeting", meetingSchema);