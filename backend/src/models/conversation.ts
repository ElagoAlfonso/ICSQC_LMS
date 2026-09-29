import mongoose, { Schema, Document } from "mongoose";

export type ConversationType = "private_user" | "private_teacher_student" | "private_student_student" | "class_group";

export interface IConversation extends Document {
  type: ConversationType;
  
  // For all types
  members: mongoose.Types.ObjectId[]; // User IDs
  removedMembers?: mongoose.Types.ObjectId[]; // Class members removed from or leaving this group
  name?: string; // For group chats
  icon?: string; // Profile picture or class icon
  
  // For teacher-student or student-student
  participantOne?: mongoose.Types.ObjectId;
  participantTwo?: mongoose.Types.ObjectId;
  
  // For class group chats
  class?: mongoose.Types.ObjectId;
  academicYear?: mongoose.Types.ObjectId;
  
  // Metadata
  lastMessage?: mongoose.Types.ObjectId; // Reference to Message
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  
  // Settings
  isActive: boolean;
  archivedBy?: mongoose.Types.ObjectId[];
  mutedBy?: mongoose.Types.ObjectId[];
  
  // For teacher moderation
  announcementOnly?: boolean; // Only teacher can send messages
}

const conversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: ["private_user", "private_teacher_student", "private_student_student", "class_group"],
      required: true,
    },
    members: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    removedMembers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    name: { type: String },
    icon: { type: String },
    participantOne: { type: Schema.Types.ObjectId, ref: "User" },
    participantTwo: { type: Schema.Types.ObjectId, ref: "User" },
    class: { type: Schema.Types.ObjectId, ref: "Class" },
    academicYear: { type: Schema.Types.ObjectId, ref: "AcademicYear" },
    lastMessage: { type: Schema.Types.ObjectId, ref: "Message" },
    lastMessageAt: { type: Date },
    lastMessagePreview: { type: String },
    isActive: { type: Boolean, default: true },
    archivedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    mutedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    announcementOnly: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Create indexes for efficient querying
conversationSchema.index({ members: 1 });
conversationSchema.index({ class: 1 });
conversationSchema.index({ lastMessageAt: -1 });

export default mongoose.model<IConversation>("Conversation", conversationSchema);
