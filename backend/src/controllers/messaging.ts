import { type Response } from "express";
import { signedUrlFor } from "../utils/cloudinary.ts";
import { type AuthRequest } from "../middleware/auth.ts";
import { logActivity } from "../utils/activitieslog.ts";
import { createNotification } from "../utils/notifications.ts";
import Conversation from "../models/conversation.ts";
import Message from "../models/message.ts";
import User from "../models/user.ts";
import Class from "../models/class.ts";
import Subject from "../models/subject.ts";
import { emitToConversation } from "../realtime.ts";
import { removeStoredAttachment, saveAttachment, validateAttachment } from "../utils/attachments.ts";

const logMessageActivity = (userId: any, action: string, details: Record<string, unknown>) =>
  logActivity({ userId: userId?.toString() || "", action, details: JSON.stringify(details) });

const isConversationMember = (conversation: any, userId: any) =>
  conversation.members.some((member: any) => member.toString() === userId?.toString());

// ═══════════════════════════════════════════════════════════════════════════
//  CONVERSATION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

export const getConversations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, type } = req.query;

    const filter: any = { members: req.user?._id, isActive: true };
    if (type) filter.type = type;

    const conversations = await Conversation.find(filter)
      .populate("members", "name email")
      .populate("class", "name")
      .populate("lastMessage")
      .sort({ lastMessageAt: -1 })
      .lean();

    let filtered = conversations;

    // Search by name or participant name
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = conversations.filter((conv: any) => {
        const convName = conv.name?.toLowerCase() || "";
        const memberNames = (conv.members || []).map((m: any) => m.name?.toLowerCase()).join(" ");
        return convName.includes(searchLower) || memberNames.includes(searchLower);
      });
    }

    res.status(200).json({
      message: "Conversations retrieved successfully",
      conversations: filtered,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ message: "Error fetching conversations", error: (error as Error).message });
  }
};

export const createPrivateConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { participantId, type } = req.body;

    if (!participantId || !type) {
      res.status(400).json({ message: "participantId and type are required" });
      return;
    }

    // Validate conversation type
    const validTypes = ["private_user", "private_teacher_student", "private_student_student"];
    if (!validTypes.includes(type)) {
      res.status(400).json({ message: "Invalid conversation type" });
      return;
    }

    const participant = await User.findById(participantId);
    if (!participant) {
      res.status(404).json({ message: "Participant not found" });
      return;
    }

    if (!req.user || !["student", "teacher"].includes(req.user.role) || !["student", "teacher"].includes(participant.role) || participantId === req.user._id.toString()) {
      res.status(400).json({ message: "This participant cannot start a private conversation" });
      return;
    }

    const currentUser = req.user;
    const sharedClass = currentUser.role === "student" && participant.role === "student"
      ? await Class.exists({ students: { $all: [currentUser._id, participantId] } })
      : await (async () => {
          const teacherIds = [currentUser._id, participantId].filter((id, index) => [currentUser.role, participant.role][index] === "teacher");
          const studentIds = [currentUser._id, participantId].filter((id, index) => [currentUser.role, participant.role][index] === "student");
          const assignedSubjects = await Subject.find({ teacher: { $in: teacherIds }, isActive: true }).select("_id").lean();
          if (teacherIds.length === 2) {
            const teacherSubjects = await Promise.all(teacherIds.map((teacherId) => Subject.find({ teacher: teacherId, isActive: true }).select("_id").lean()));
            const subjectIds = teacherSubjects.flat().map((subject) => subject._id);
            return Class.exists({
              $or: [
                { subjects: { $all: subjectIds } },
                { adviser: teacherIds[0], subjects: { $in: (teacherSubjects[1] || []).map((subject) => subject._id) } },
                { adviser: teacherIds[1], subjects: { $in: (teacherSubjects[0] || []).map((subject) => subject._id) } },
              ],
            });
          }
          return Class.exists({
            students: { $in: studentIds },
            $or: [{ adviser: { $in: teacherIds } }, { subjects: { $in: assignedSubjects.map((subject) => subject._id) } }],
          });
        })();
    if (!sharedClass) {
      res.status(403).json({ message: "You can only message people connected through your classes" });
      return;
    }

    // Check if conversation already exists
    const existingConversation = await Conversation.findOne({
      type: { $in: ["private_user", "private_teacher_student", "private_student_student"] },
      members: { $all: [req.user?._id, participantId] },
    });

    if (existingConversation) {
      res.status(200).json({
        message: "Conversation already exists",
        conversation: existingConversation,
      });
      return;
    }

    // Create new conversation
    const conversation = new Conversation({
      type: "private_user",
      members: [req.user?._id, participantId],
      participantOne: req.user?._id,
      participantTwo: participantId,
    });

    await conversation.save();
    await logMessageActivity(req.user?._id, `Started ${type} conversation`, { conversationId: conversation._id, participantId });

    const populatedConversation = await Conversation.findById(conversation._id)
      .populate("members", "name email")
      .populate("lastMessage");

    res.status(201).json({
      message: "Conversation created successfully",
      conversation: populatedConversation,
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ message: "Error creating conversation", error: (error as Error).message });
  }
};

export const getClassGroupConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;

    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      res.status(404).json({ message: "Class not found" });
      return;
    }

    const isClassMember = classDoc.students.some((studentId: any) => studentId.toString() === req.user?._id.toString())
      || classDoc.adviser?.toString() === req.user?._id.toString()
      || req.user?.role === "admin";
    if (!isClassMember) {
      res.status(403).json({ message: "You are not a member of this class" });
      return;
    }

    let conversation = await Conversation.findOne({
      type: "class_group",
      class: classId,
    });

    const assignedSubjects = await Subject.find({ _id: { $in: classDoc.subjects || [] } }).select("teacher").lean();
    const currentMembers = [
      ...(classDoc.students || []),
      ...(classDoc.adviser ? [classDoc.adviser] : []),
      ...assignedSubjects.map((subject) => subject.teacher).filter(Boolean),
    ];
    const removedMemberIds = new Set((conversation?.removedMembers || []).map((member: any) => member.toString()));
    const memberIds = Array.from(new Set(currentMembers.map((member: any) => member.toString()))).filter((memberId) => !removedMemberIds.has(memberId));

    if (!conversation) {
      // Create class group chat automatically
      conversation = new Conversation({
        type: "class_group",
        members: memberIds,
        class: classId,
        name: (classDoc as any).name || `${classDoc.section} Group Chat`,
        isActive: true,
      });

      await conversation.save();
    } else if (conversation.members.map((member: any) => member.toString()).sort().join(",") !== memberIds.sort().join(",")) {
      conversation.members = memberIds as any;
      await conversation.save();
    }

    conversation = await Conversation.findById(conversation._id)
      .populate("members", "name email")
      .populate("lastMessage");

    res.status(200).json({
      message: "Class group conversation retrieved successfully",
      conversation,
    });
  } catch (error) {
    console.error("Error fetching class conversation:", error);
    res.status(500).json({ message: "Error fetching class conversation", error: (error as Error).message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
//  MESSAGE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    // Verify user is a member
    const isMember = conversation.members.some((m: any) => m.toString() === req.user?._id.toString());
    if (!isMember) {
      res.status(403).json({ message: "You are not a member of this conversation" });
      return;
    }

    const messages = await Message.find({
      conversation: conversationId,
      isDeleted: false,
    })
      .populate("sender", "name email")
      .populate({ path: "replyTo.replyToMessageId", select: "text sender", match: { isDeleted: false } })
      .populate("reactions.userId", "name")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(offset as string))
      .lean();

    const visibleMessages = messages.map((message: any) => {
      if (message.replyTo && !message.replyTo.replyToMessageId) {
        message.replyTo.replyToText = undefined;
      }
      return message;
    });

    res.status(200).json({
      message: "Messages retrieved successfully",
      messages: visibleMessages.reverse(),
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Error fetching messages", error: (error as Error).message });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const savedPaths: string[] = [];
  try {
    const { conversationId } = req.params;
    const { text, replyToMessageId, clientMessageId } = req.body;
    const files = (req.files || []) as Express.Multer.File[];
    const messageText = typeof text === "string" ? text.trim() : "";

    if (!messageText && files.length === 0) {
      res.status(400).json({ message: "Message text is required" });
      return;
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    // Verify user is a member
    const isMember = conversation.members.some((m: any) => m.toString() === req.user?._id.toString());
    if (!isMember) {
      res.status(403).json({ message: "You are not a member of this conversation" });
      return;
    }

    if (clientMessageId) {
      const existingMessage = await Message.findOne({ conversation: conversationId, clientMessageId })
        .populate("sender", "name email")
        .populate("replyTo.replyToMessageId");
      if (existingMessage) {
        res.status(200).json({ message: existingMessage, statusMessage: "Message already sent" });
        return;
      }
    }

    // Check announcement-only mode
    const user = await User.findById(req.user?._id);
    if (conversation.announcementOnly && user?.role !== "teacher") {
      res.status(403).json({ message: "This conversation is in announcement-only mode" });
      return;
    }

    // Handle reply to message
    let replyData: any = null;
    if (replyToMessageId) {
      const replyToMessage = await Message.findOne({ _id: replyToMessageId, conversation: conversationId, isDeleted: false });
      if (replyToMessage) {
        const replyAuthor = await User.findById(replyToMessage.sender);
        replyData = {
          replyToMessageId,
          replyToText: replyToMessage.text?.substring(0, 100),
          replyToAuthorName: (replyAuthor as any)?.name,
        };
      }
    }

    const uploadedAttachments = [];
    for (const file of files) {
      const extension = validateAttachment(file);
      const stored = await saveAttachment(file, extension);
      savedPaths.push(stored.storagePath);
      uploadedAttachments.push({ originalName: file.originalname, ...stored, extension, mimeType: file.mimetype, size: file.size });
    }

    const message = new Message({
      conversation: conversationId,
      sender: req.user?._id,
      clientMessageId,
      text: messageText || "Attachment",
      attachments: uploadedAttachments,
      replyTo: replyData,
      reactions: [],
    });

    await message.save();

    // Update conversation with last message
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      lastMessageAt: new Date(),
      lastMessagePreview: (messageText || "Attachment").substring(0, 50),
    });

    // Notify other members (non-Socket.IO fallback)
    const otherMembers = conversation.members.filter((m: any) => m.toString() !== req.user?._id.toString());
    for (const memberId of otherMembers) {
      await createNotification({
        recipient: memberId,
        title: "New Message",
        message: `New message in ${conversation.name || "conversation"}`,
        type: "message",
        relatedResource: message._id,
        relatedClass: conversation.class,
      });
    }

    await logMessageActivity(req.user?._id, `Sent message`, { conversationId, messageId: message._id });

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name email")
      .populate("replyTo.replyToMessageId");

    emitToConversation(String(conversationId), "message:new", populatedMessage);

    res.status(201).json({
      message: populatedMessage,
      statusMessage: "Message sent successfully",
    });
  } catch (error) {
    await Promise.all(savedPaths.map(removeStoredAttachment));
    if ((error as any)?.code === 11000 && req.body.clientMessageId) {
      const existingMessage = await Message.findOne({
        conversation: req.params.conversationId,
        clientMessageId: req.body.clientMessageId,
      })
        .populate("sender", "name email")
        .populate("replyTo.replyToMessageId");
      if (existingMessage) {
        res.status(200).json({ message: existingMessage, statusMessage: "Message already sent" });
        return;
      }
    }
    console.error("Error sending message:", error);
    const errorMessage = (error as Error).message;
    const isUploadError = errorMessage.includes("Unsupported file") || errorMessage.includes("MIME") || errorMessage.includes("signature") || errorMessage.includes("maximum allowed") || errorMessage.includes("corrupted");
    res.status(isUploadError ? 400 : 500).json({ message: isUploadError ? errorMessage : "Error sending message", error: errorMessage });
  }
};

export const downloadMessageAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId).select("members");
    if (!conversation || !isConversationMember(conversation, req.user?._id)) {
      res.status(403).json({ message: "You are not a member of this conversation" });
      return;
    }
    const message = await Message.findOne({ _id: req.params.messageId, conversation: req.params.conversationId }).select("attachments");
    if (!message) { res.status(404).json({ message: "Message not found" }); return; }
    const attachment = message.attachments.find((item: any) => item._id.toString() === req.params.attachmentId);
    if (!attachment) { res.status(404).json({ message: "Attachment not found" }); return; }

    const url = signedUrlFor(attachment.storagePath, {
      download: req.query.download === "1" ? attachment.originalName : undefined,
    });
    res.redirect(302, url);
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ message: "Unable to retrieve message attachment" });
  }
};

export const editMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      res.status(400).json({ message: "Message text is required" });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    if (message.conversation.toString() !== req.params.conversationId) {
      res.status(403).json({ message: "This message does not belong to the conversation" });
      return;
    }

    // Only sender can edit
    if (message.sender.toString() !== req.user?._id.toString()) {
      res.status(403).json({ message: "You can only edit your own messages" });
      return;
    }

    // Store edit history
    if (!message.editHistory) message.editHistory = [];
    message.editHistory.push(message.text);

    message.text = text.trim();
    message.isEdited = true;
    message.editedAt = new Date();

    await message.save();
    emitToConversation(String(message.conversation), "message:updated", message);

    await logMessageActivity(req.user?._id, `Edited message`, { messageId });

    res.status(200).json({
      message,
      statusMessage: "Message updated successfully",
    });
  } catch (error) {
    console.error("Error editing message:", error);
    res.status(500).json({ message: "Error editing message", error: (error as Error).message });
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    if (message.conversation.toString() !== req.params.conversationId) {
      res.status(403).json({ message: "This message does not belong to the conversation" });
      return;
    }

    const conversation = await Conversation.findById(message.conversation);
    const isSender = message.sender.toString() === req.user?._id.toString();
    const isTeacher = req.user?.role === "teacher" || req.user?.role === "admin";

    // Only sender or teacher in class chat can delete
    if (!isSender && !(isTeacher && conversation?.type === "class_group")) {
      res.status(403).json({ message: "You cannot delete this message" });
      return;
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = req.user?._id;

    await message.save();
    emitToConversation(String(message.conversation), "message:deleted", { messageId: message._id });

    await logMessageActivity(req.user?._id, `Deleted message`, { messageId });

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ message: "Error deleting message", error: (error as Error).message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
//  MESSAGE REACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export const addMessageReaction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      res.status(400).json({ message: "Emoji is required" });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    if (message.conversation.toString() !== req.params.conversationId) {
      res.status(403).json({ message: "This message does not belong to the conversation" });
      return;
    }

    const conversation = await Conversation.findById(message.conversation);
    if (!conversation || !isConversationMember(conversation, req.user?._id)) {
      res.status(403).json({ message: "You are not a member of this conversation" });
      return;
    }

    message.reactions = (message.reactions || []).filter((reaction: any) => reaction.userId.toString() !== req.user?._id.toString());
    message.reactions.push({ userId: req.user!._id, emoji, createdAt: new Date() });
    await message.save();
    const reactions = message.reactions;
    emitToConversation(String(message.conversation), "reaction:updated", { messageId, reactions });

    await logMessageActivity(req.user?._id, `Reacted to message`, { messageId, emoji });

    res.status(201).json({
      message: "Reaction added successfully",
      reactions,
    });
  } catch (error) {
    console.error("Error adding reaction:", error);
    res.status(500).json({ message: "Error adding reaction", error: (error as Error).message });
  }
};

export const removeMessageReaction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    if (message.conversation.toString() !== req.params.conversationId) {
      res.status(403).json({ message: "This message does not belong to the conversation" });
      return;
    }

    const conversation = await Conversation.findById(message.conversation);
    if (!conversation || !isConversationMember(conversation, req.user?._id)) {
      res.status(403).json({ message: "You are not a member of this conversation" });
      return;
    }

    message.reactions = message.reactions.filter(
      (r: any) => !(r.userId.toString() === req.user?._id.toString() && r.emoji === emoji)
    );

    await message.save();
    emitToConversation(String(message.conversation), "reaction:updated", { messageId, reactions: message.reactions });

    await logMessageActivity(req.user?._id, `Removed reaction from message`, { messageId, emoji });

    res.status(200).json({
      message: "Reaction removed successfully",
      reactions: message.reactions,
    });
  } catch (error) {
    console.error("Error removing reaction:", error);
    res.status(500).json({ message: "Error removing reaction", error: (error as Error).message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
//  CLASS MODERATION
// ═══════════════════════════════════════════════════════════════════════════

export const toggleAnnouncementOnly = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      res.status(404).json({ message: "Conversation not found" });
      return;
    }

    if (conversation.type !== "class_group") {
      res.status(400).json({ message: "Only class group chats support announcement-only mode" });
      return;
    }

    // Only teacher can toggle
    if (req.user?.role !== "teacher" && req.user?.role !== "admin") {
      res.status(403).json({ message: "Only teachers can toggle announcement-only mode" });
      return;
    }

    const assignedSubjects = await Subject.find({ _id: { $in: (await Class.findById(conversation.class).select("subjects").lean())?.subjects || [] }, teacher: req.user._id }).select("_id").lean();
    const isAssignedTeacher = req.user.role === "admin" || Boolean(await Class.exists({ _id: conversation.class, $or: [{ adviser: req.user._id }, { subjects: { $in: assignedSubjects.map((subject) => subject._id) } }] }));
    if (!isAssignedTeacher) {
      res.status(403).json({ message: "Only the assigned teacher can moderate this class chat" });
      return;
    }

    conversation.announcementOnly = !conversation.announcementOnly;
    await conversation.save();

    await logMessageActivity(req.user?._id, `Toggled announcement-only mode`, { conversationId });

    res.status(200).json({
      message: "Announcement-only mode toggled",
      conversation,
    });
  } catch (error) {
    console.error("Error toggling announcement-only:", error);
    res.status(500).json({ message: "Error toggling announcement-only", error: (error as Error).message });
  }
};

export const updateGroupSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || conversation.type !== "class_group") {
      res.status(404).json({ message: "Group chat not found" });
      return;
    }
    if (!isConversationMember(conversation, req.user?._id)) {
      res.status(403).json({ message: "You are not a member of this group chat" });
      return;
    }

    const canManage = req.user?.role === "admin"
      || (req.user?.role === "teacher" && isConversationMember(conversation, req.user._id));

    if (canManage && typeof req.body.announcementOnly === "string") {
      conversation.announcementOnly = req.body.announcementOnly === "true";
    }
    if (canManage && typeof req.body.name === "string" && req.body.name.trim()) {
      conversation.name = req.body.name.trim().slice(0, 100);
    }
    const photo = (req as any).file as Express.Multer.File | undefined;
    if (photo) {
      if (!photo.mimetype.startsWith("image/")) {
        res.status(400).json({ message: "Group photo must be an image." });
        return;
      }
      const extension = validateAttachment(photo);
      const saved = await saveAttachment(photo, extension);
      conversation.icon = saved.storageName;
    }
    await conversation.save();
    res.status(200).json({ message: "Group settings updated", conversation });
  } catch (error) {
    console.error("Error updating group settings:", error);
    res.status(400).json({ message: (error as Error).message || "Unable to update group settings" });
  }
};

export const addGroupMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    const { userId } = req.body;
    if (!conversation || conversation.type !== "class_group" || !isConversationMember(conversation, req.user?._id)) {
      res.status(403).json({ message: "You are not a member of this group chat" });
      return;
    }
    const target = await User.findById(userId).select("name role");
    const classDoc = await Class.findById(conversation.class).select("students").lean();
    const isClassStudent = Boolean(classDoc?.students.some((studentId: any) => studentId.toString() === userId));
    if (!target || target.role !== "student" || !isClassStudent) {
      res.status(400).json({ message: "Only students from this class can be added" });
      return;
    }
    if (!conversation.members.some((member: any) => member.toString() === userId)) conversation.members.push(target._id);
    conversation.removedMembers = (conversation.removedMembers || []).filter((member: any) => member.toString() !== userId);
    await conversation.save();
    const updated = await Conversation.findById(conversation._id).populate("members", "name email profileImage");
    res.status(200).json({ message: "Member added", conversation: updated });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message || "Unable to add member" });
  }
};

export const removeGroupMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || conversation.type !== "class_group" || !isConversationMember(conversation, req.user?._id)) {
      res.status(403).json({ message: "You are not a member of this group chat" });
      return;
    }
    if (req.user?.role !== "teacher" && req.user?.role !== "admin") {
      res.status(403).json({ message: "Only teachers and admins can remove students" });
      return;
    }
    const target = await User.findById(req.body.userId).select("role");
    if (!target || target.role !== "student") {
      res.status(400).json({ message: "Only students can be removed" });
      return;
    }
    conversation.members = conversation.members.filter((member: any) => member.toString() !== req.body.userId) as any;
    if (!(conversation.removedMembers || []).some((member: any) => member.toString() === req.body.userId)) conversation.removedMembers?.push(target._id);
    if (!conversation.removedMembers) conversation.removedMembers = [target._id];
    await conversation.save();
    const updated = await Conversation.findById(conversation._id).populate("members", "name email profileImage");
    res.status(200).json({ message: "Member removed", conversation: updated });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message || "Unable to remove member" });
  }
};

export const leaveGroup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation || conversation.type !== "class_group" || !isConversationMember(conversation, req.user?._id)) {
      res.status(404).json({ message: "Group chat not found" });
      return;
    }
    const userId = req.user!._id;
    conversation.members = conversation.members.filter((member: any) => member.toString() !== userId.toString()) as any;
    if (!(conversation.removedMembers || []).some((member: any) => member.toString() === userId.toString())) conversation.removedMembers?.push(userId);
    if (!conversation.removedMembers) conversation.removedMembers = [userId];
    await conversation.save();
    res.status(200).json({ message: "You left the group chat" });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message || "Unable to leave group" });
  }
};

export const getGroupPhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  const conversation = await Conversation.findById(req.params.conversationId).select("members type icon").lean();
  if (!conversation || conversation.type !== "class_group" || !isConversationMember(conversation, req.user?._id)) {
    res.status(404).end();
    return;
  }
  if (!conversation.icon) {
    res.status(404).end();
    return;
  }
  res.setHeader("Cache-Control", "no-store");
     res.redirect(302, signedUrlFor(`image:${conversation.icon}`));
};
