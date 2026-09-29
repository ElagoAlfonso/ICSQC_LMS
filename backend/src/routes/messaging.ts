import express from "express";
import {
  getConversations,
  createPrivateConversation,
  getClassGroupConversation,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  addMessageReaction,
  removeMessageReaction,
  toggleAnnouncementOnly,
  updateGroupSettings,
  getGroupPhoto,
  addGroupMember,
  removeGroupMember,
  leaveGroup,
  downloadMessageAttachment,
} from "../controllers/messaging.ts";
import { protect } from "../middleware/auth.ts";
import { parseGroupPhoto, parseSubjectAttachments } from "../middleware/upload.ts";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
//  CONVERSATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// Get all conversations for current user
router.get("/", protect, getConversations);

// Create private conversation (teacher-student or student-student)
router.post("/private", protect, createPrivateConversation);

// Get or create class group conversation
router.get("/class/:classId", protect, getClassGroupConversation);

// Read and update class group settings and photo
router.get("/:conversationId/icon", protect, getGroupPhoto);
router.patch("/:conversationId/settings", protect, parseGroupPhoto, updateGroupSettings);
router.post("/:conversationId/members", protect, addGroupMember);
router.delete("/:conversationId/members", protect, removeGroupMember);
router.post("/:conversationId/leave", protect, leaveGroup);

// ═══════════════════════════════════════════════════════════════════════════
//  MESSAGE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// Get messages in a conversation
router.get("/:conversationId/messages", protect, getMessages);

// Send message
router.post("/:conversationId/messages", protect, parseSubjectAttachments, sendMessage);

// Download an attachment only when the requester belongs to the conversation.
router.get("/:conversationId/messages/:messageId/attachments/:attachmentId", protect, downloadMessageAttachment);

// Edit message
router.put("/:conversationId/messages/:messageId", protect, editMessage);

// Delete message
router.delete("/:conversationId/messages/:messageId", protect, deleteMessage);

// ═══════════════════════════════════════════════════════════════════════════
//  MESSAGE REACTION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// Add reaction to message
router.post("/:conversationId/messages/:messageId/reactions", protect, addMessageReaction);

// Remove reaction from message
router.delete("/:conversationId/messages/:messageId/reactions", protect, removeMessageReaction);

// ═══════════════════════════════════════════════════════════════════════════
//  MODERATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// Toggle announcement-only mode
router.patch("/:conversationId/announcement-only", protect, toggleAnnouncementOnly);

export default router;
