import mongoose, { Document, Schema } from "mongoose";

export type NotificationType = "user" | "exam" | "submission" | "announcement" | "comment" | "meeting" | "message" | "system";

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  relatedResource?: mongoose.Types.ObjectId;
  relatedClass?: mongoose.Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ["user", "exam", "submission", "announcement", "comment", "meeting", "message", "system"], required: true },
    relatedResource: { type: Schema.Types.ObjectId },
    relatedClass: { type: Schema.Types.ObjectId, ref: "Class" },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model<INotification>("Notification", notificationSchema);
