import mongoose, { Schema, Document } from "mongoose";

export type ReactionEmoji = "👍" | "❤️" | "🎉" | "👏" | "💯" | "🙏" | "😮" | "😂";

export interface IReaction extends Document {
  // Relationships
  announcement: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  
  // Reaction
  emoji: ReactionEmoji;
}

const reactionSchema = new Schema<IReaction>(
  {
    announcement: { type: Schema.Types.ObjectId, ref: "Announcement", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emoji: {
      type: String,
      enum: ["👍", "❤️", "🎉", "👏", "💯", "🙏", "😮", "😂"],
      required: true,
    },
  },
  { timestamps: true }
);

// One active reaction per user and announcement.
reactionSchema.index({ announcement: 1, user: 1 }, { unique: true });

export default mongoose.model<IReaction>("Reaction", reactionSchema);
