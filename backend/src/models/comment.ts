import mongoose, { Schema, Document } from "mongoose";

export interface IComment extends Document {
  // Relationships
  announcement: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  class: mongoose.Types.ObjectId;
  
  // Metadata
  replyTo?: mongoose.Types.ObjectId; // Parent comment for threading
  
  // Content
  text: string;
  
  // Status
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  
  // Engagement
  likeCount?: number;
  replyCount?: number;
}

const commentSchema = new Schema<IComment>(
  {
    announcement: { type: Schema.Types.ObjectId, ref: "Announcement", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    replyTo: { type: Schema.Types.ObjectId, ref: "Comment" },
    text: { type: String, required: true },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    likeCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Create indexes
commentSchema.index({ announcement: 1, createdAt: -1 });
commentSchema.index({ author: 1 });
commentSchema.index({ replyTo: 1 });

export default mongoose.model<IComment>("Comment", commentSchema);
