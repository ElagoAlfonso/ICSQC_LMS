import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth.ts";
import { logActivity } from "../utils/activitieslog.ts";
import { createNotification } from "../utils/notifications.ts";
import Comment from "../models/comment.ts";
import Reaction from "../models/reaction.ts";
import Announcement from "../models/announcement.ts";
import User from "../models/user.ts";
import Class from "../models/class.ts";
import Subject from "../models/subject.ts";
import { emitToAnnouncement } from "../realtime.ts";

const getGroupedReactions = async (announcementId: string) => {
  const reactions = await Reaction.find({ announcement: announcementId })
    .populate("user", "name email")
    .lean();
  return reactions.reduce<Record<string, any[]>>((grouped, reaction: any) => {
    (grouped[reaction.emoji] ||= []).push(reaction.user);
    return grouped;
  }, {});
};

const canAccessAnnouncement = async (user: AuthRequest["user"], announcement: any) => {
  if (!user) return false;
  if (user.role === "admin" || announcement.author?.toString() === user._id.toString()) return true;
  if (!announcement.isActive || (announcement.expiresAt && new Date(announcement.expiresAt) < new Date())) return false;
  if (announcement.targetUsers?.some((targetUser: any) => targetUser.toString() === user._id.toString())) return true;
  if (!announcement.targetClass) return announcement.targetRole === "all" || announcement.targetRole === user.role;
  if (user.role === "student") {
    return Boolean(await Class.exists({
      _id: announcement.targetClass,
      isActive: true,
      $or: [{ students: user._id }, { _id: user.studentClass }],
    }));
  }
  if (user.role === "teacher") {
    const subjects = await Subject.find({ teacher: user._id, isActive: true }).select("_id").lean();
    return Boolean(await Class.exists({ _id: announcement.targetClass, $or: [{ adviser: user._id }, { subjects: { $in: subjects.map((subject) => subject._id) } }] }));
  }
  return false;
};

// ═══════════════════════════════════════════════════════════════════════════
//  COMMENT OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const createComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { announcementId } = req.params;
    const { text, replyToCommentId } = req.body;

    if (!text || text.trim().length === 0) {
      res.status(400).json({ message: "Comment text is required" });
      return;
    }

    const announcement = await Announcement.findById(announcementId);
    if (!announcement) {
      res.status(404).json({ message: "Announcement not found" });
      return;
    }
    if (!(await canAccessAnnouncement(req.user, announcement))) {
      res.status(403).json({ message: "You are not authorized to access this discussion" });
      return;
    }

    const comment = new Comment({
      announcement: announcementId,
      author: req.user?._id,
      class: announcement.targetClass,
      replyTo: replyToCommentId,
      text: text.trim(),
    });

    if (replyToCommentId) {
      const parentComment = await Comment.findOne({ _id: replyToCommentId, announcement: announcementId, isDeleted: false });
      if (!parentComment) {
        res.status(400).json({ message: "Reply target does not belong to this announcement" });
        return;
      }
    }

    await comment.save();

    // Increment reply count on parent comment if this is a reply
    if (replyToCommentId) {
      await Comment.findByIdAndUpdate(replyToCommentId, {
        $inc: { replyCount: 1 },
      });

      // Notify parent comment author
      const parentComment = await Comment.findById(replyToCommentId);
      if (parentComment && parentComment.author.toString() !== req.user?._id.toString()) {
        const author = await User.findById(req.user?._id);
        await createNotification({
          recipient: parentComment.author,
          title: "New Reply to Your Comment",
          message: `${author?.name} replied to your comment`,
          type: "comment",
          relatedResource: comment._id,
          relatedClass: announcement.targetClass,
        });
      }
    } else {
      // Notify announcement author if commenting directly on announcement
      if (announcement.author.toString() !== req.user?._id.toString()) {
        const author = await User.findById(req.user?._id);
        await createNotification({
          recipient: announcement.author,
          title: "New Comment on Your Announcement",
          message: `${author?.name} commented on: ${announcement.title}`,
          type: "comment",
          relatedResource: comment._id,
          relatedClass: announcement.targetClass,
        });
      }
    }

    await logActivity({ userId: req.user?._id.toString() || "", action: `Commented on announcement: ${announcement.title}`, details: JSON.stringify({ announcementId, commentId: comment._id }) });

    const populatedComment = await Comment.findById(comment._id).populate("author", "name email");
    emitToAnnouncement(String(announcementId), "announcement:comment-added", { comment: populatedComment });

    res.status(201).json({
      message: "Comment created successfully",
      comment: populatedComment,
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ message: "Error creating comment", error: (error as Error).message });
  }
};

export const getComments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { announcementId } = req.params;
    const announcement = await Announcement.findById(announcementId).select("author targetClass targetRole isActive expiresAt");
    if (!announcement) { res.status(404).json({ message: "Announcement not found" }); return; }
    if (!(await canAccessAnnouncement(req.user, announcement))) {
      res.status(200).json({
        message: "Comments retrieved successfully",
        comments: [],
      });
      return;
    }
    const { replyTo } = req.query;

    const filter: any = { announcement: announcementId, isDeleted: false };
    if (replyTo === "null" || replyTo === undefined) {
      filter.replyTo = null;
    } else if (replyTo) {
      filter.replyTo = replyTo;
    }

    const comments = await Comment.find(filter)
      .populate("author", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      message: "Comments retrieved successfully",
      comments,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ message: "Error fetching comments", error: (error as Error).message });
  }
};

export const updateComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      res.status(400).json({ message: "Comment text is required" });
      return;
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }
    const announcement = await Announcement.findById(comment.announcement).select("author targetClass targetRole isActive expiresAt");
    if (!(await canAccessAnnouncement(req.user, announcement))) { res.status(403).json({ message: "You are not authorized to edit this discussion" }); return; }

    // Only author can edit their own comment
    if (comment.author.toString() !== req.user?._id.toString()) {
      res.status(403).json({ message: "You can only edit your own comments" });
      return;
    }

    comment.text = text.trim();
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    await logActivity({ userId: req.user?._id.toString() || "", action: `Edited comment`, details: JSON.stringify({ commentId }) });

    const populatedComment = await Comment.findById(comment._id).populate("author", "name email");
    emitToAnnouncement(String(comment.announcement), "announcement:comment-updated", { comment: populatedComment });

    res.status(200).json({
      message: "Comment updated successfully",
      comment: populatedComment,
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({ message: "Error updating comment", error: (error as Error).message });
  }
};

export const deleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      res.status(404).json({ message: "Comment not found" });
      return;
    }

    // Author or teacher can delete
    const announcement = await Announcement.findById(comment.announcement);
    if (!(await canAccessAnnouncement(req.user, announcement))) { res.status(403).json({ message: "You are not authorized to delete this discussion" }); return; }
    const isTeacher = req.user?.role === "teacher" || req.user?.role === "admin";
    const isAuthor = comment.author.toString() === req.user?._id.toString();
    const isAnnouncementAuthor = announcement?.author.toString() === req.user?._id.toString();

    if (!isAuthor && !isTeacher && !isAnnouncementAuthor) {
      res.status(403).json({ message: "You cannot delete this comment" });
      return;
    }

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    await comment.save();

    // Decrement reply count on parent if this was a reply
    if (comment.replyTo) {
      await Comment.findByIdAndUpdate(comment.replyTo, {
        $inc: { replyCount: -1 },
      });
    }

    await logActivity({ userId: req.user?._id.toString() || "", action: `Deleted comment`, details: JSON.stringify({ commentId }) });
    emitToAnnouncement(String(comment.announcement), "announcement:comment-deleted", { commentId });

    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ message: "Error deleting comment", error: (error as Error).message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
//  REACTION OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const addReaction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { announcementId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      res.status(400).json({ message: "Emoji is required" });
      return;
    }

    const validEmojis = ["👍", "❤️", "🎉", "👏", "💯", "🙏", "😮", "😂"];
    if (!validEmojis.includes(emoji)) {
      res.status(400).json({ message: "Invalid emoji" });
      return;
    }

    const announcement = await Announcement.findById(announcementId);
    if (!announcement) {
      res.status(404).json({ message: "Announcement not found" });
      return;
    }
    if (!(await canAccessAnnouncement(req.user, announcement))) { res.status(403).json({ message: "You are not authorized to react to this announcement" }); return; }

    const reaction = await Reaction.findOneAndUpdate(
      { announcement: announcementId, user: req.user?._id },
      { $set: { emoji } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    await logActivity({ userId: req.user?._id.toString() || "", action: `Reacted to announcement: ${announcement.title}`, details: JSON.stringify({ announcementId, emoji }) });

    const reactions = await getGroupedReactions(String(announcementId));
    emitToAnnouncement(String(announcementId), "announcement:reactions-updated", { reactions });

    res.status(201).json({
      message: "Reaction added successfully",
      reaction,
      reactions,
    });
  } catch (error) {
    console.error("Error adding reaction:", error);
    res.status(500).json({ message: "Error adding reaction", error: (error as Error).message });
  }
};

export const removeReaction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { announcementId } = req.params;
    const { emoji } = req.body;
    const announcement = await Announcement.findById(announcementId).select("author targetClass targetRole isActive expiresAt");
    if (!announcement) { res.status(404).json({ message: "Announcement not found" }); return; }
    if (!(await canAccessAnnouncement(req.user, announcement))) { res.status(403).json({ message: "You are not authorized to react to this announcement" }); return; }

    const reaction = await Reaction.findOneAndDelete({
      announcement: announcementId,
      user: req.user?._id,
      emoji,
    });

    if (!reaction) {
      res.status(404).json({ message: "Reaction not found" });
      return;
    }

    await logActivity({ userId: req.user?._id.toString() || "", action: `Removed reaction from announcement`, details: JSON.stringify({ announcementId, emoji }) });

    const reactions = await getGroupedReactions(String(announcementId));
    emitToAnnouncement(String(announcementId), "announcement:reactions-updated", { reactions });

    res.status(200).json({ message: "Reaction removed successfully", reactions });
  } catch (error) {
    console.error("Error removing reaction:", error);
    res.status(500).json({ message: "Error removing reaction", error: (error as Error).message });
  }
};

export const changeReaction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { announcementId } = req.params;
    const { oldEmoji, newEmoji } = req.body;
    const announcement = await Announcement.findById(announcementId).select("author targetClass targetRole isActive expiresAt");
    if (!announcement) { res.status(404).json({ message: "Announcement not found" }); return; }
    if (!(await canAccessAnnouncement(req.user, announcement))) { res.status(403).json({ message: "You are not authorized to react to this announcement" }); return; }

    if (!oldEmoji || !newEmoji) {
      res.status(400).json({ message: "oldEmoji and newEmoji are required" });
      return;
    }

    const validEmojis = ["👍", "❤️", "🎉", "👏", "💯", "🙏", "😮", "😂"];
    if (!validEmojis.includes(newEmoji)) {
      res.status(400).json({ message: "Invalid emoji" });
      return;
    }

    // Check if already reacted with new emoji
    const existingReaction = await Reaction.findOne({
      announcement: announcementId,
      user: req.user?._id,
      emoji: newEmoji,
    });

    if (existingReaction) {
      res.status(400).json({ message: "You already reacted with this emoji" });
      return;
    }

    // Delete old reaction and create new one
    const oldReaction = await Reaction.findOneAndDelete({
      announcement: announcementId,
      user: req.user?._id,
      emoji: oldEmoji,
    });

    if (!oldReaction) {
      res.status(404).json({ message: "Previous reaction not found" });
      return;
    }

    const newReaction = new Reaction({
      announcement: announcementId,
      user: req.user?._id,
      emoji: newEmoji,
    });

    await newReaction.save();

    await logActivity({ userId: req.user?._id.toString() || "", action: `Changed reaction on announcement`, details: JSON.stringify({ announcementId, oldEmoji, newEmoji }) });

    const reactions = await getGroupedReactions(String(announcementId));
    emitToAnnouncement(String(announcementId), "announcement:reactions-updated", { reactions });

    res.status(200).json({
      message: "Reaction changed successfully",
      reaction: newReaction,
      reactions,
    });
  } catch (error) {
    console.error("Error changing reaction:", error);
    res.status(500).json({ message: "Error changing reaction", error: (error as Error).message });
  }
};

export const getReactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { announcementId } = req.params;
    const announcement = await Announcement.findById(announcementId).select("author targetClass targetRole isActive expiresAt");
    if (!announcement) { res.status(404).json({ message: "Announcement not found" }); return; }
    if (!(await canAccessAnnouncement(req.user, announcement))) { res.status(403).json({ message: "You are not authorized to view these reactions" }); return; }

    const grouped = await getGroupedReactions(String(announcementId));

    res.status(200).json({
      message: "Reactions retrieved successfully",
      reactions: grouped,
    });
  } catch (error) {
    console.error("Error fetching reactions:", error);
    res.status(500).json({ message: "Error fetching reactions", error: (error as Error).message });
  }
};
