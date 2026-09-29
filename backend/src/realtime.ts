import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "./models/user.ts";
import Conversation from "./models/conversation.ts";
import Message from "./models/message.ts";
import Announcement from "./models/announcement.ts";
import Class from "./models/class.ts";
import Subject from "./models/subject.ts";

let io: Server | null = null;

export const initializeRealtime = (server: any) => {
  if (io) {
    return io;
  }

  const allowedOrigins = new Set(
    (process.env.CLIENT_URL || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
  if (process.env.NODE_ENV === "development") {
    allowedOrigins.add("http://localhost:5173");
  }

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => callback(null, origin && allowedOrigins.has(origin) ? origin : false),
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie || "";
      const token = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith("jwt="))?.slice(4);
      if (!token) return next(new Error("Not authenticated"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
      const user = await User.findById(decoded.userId).select("-password");
      if (!user || !user.isActive) return next(new Error("User not found"));
      socket.data.user = user;
      next();
    } catch {
      next(new Error("Not authenticated"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.user._id.toString();
    socket.join(`user:${userId}`);
    const broadcastPresence = async (online: boolean) => {
      const conversations = await Conversation.find({ members: socket.data.user._id }).select("_id").lean();
      conversations.forEach((conversation) => {
        socket.to(`conversation:${conversation._id}`).emit("presence:update", { userId, online });
      });
    };
    void broadcastPresence(true);

    socket.on("conversation:join", async (conversationId: string, callback?: (result: { ok: boolean; message?: string }) => void) => {
      const conversation = await Conversation.findById(conversationId).select("members");
      const isMember = conversation?.members.some((member) => member.toString() === userId);
      if (!isMember) {
        callback?.({ ok: false, message: "Not a conversation member" });
        return;
      }
      socket.join(`conversation:${conversationId}`);
      callback?.({ ok: true });
    });

    socket.on("conversation:leave", (conversationId: string) => socket.leave(`conversation:${conversationId}`));

    socket.on("announcement:join", async (announcementId: string, callback?: (result: { ok: boolean; message?: string }) => void) => {
      const announcement = await Announcement.findById(announcementId).select("author targetUsers targetClass targetRole isActive expiresAt");
      if (!announcement) {
        callback?.({ ok: false, message: "Announcement not found" });
        return;
      }

      const isAuthor = announcement.author.toString() === userId;
      const isActive = announcement.isActive && (!announcement.expiresAt || new Date(announcement.expiresAt) >= new Date());
      let canAccess = isAuthor || socket.data.user.role === "admin";
      if (!canAccess && announcement.targetUsers?.some((targetUser) => targetUser.toString() === userId)) canAccess = true;
      if (!canAccess && isActive && !announcement.targetClass) {
        canAccess = announcement.targetRole === "all" || announcement.targetRole === socket.data.user.role;
      }
      if (!canAccess && isActive && announcement.targetClass) {
        if (socket.data.user.role === "student") {
          canAccess = Boolean(await Class.exists({
            _id: announcement.targetClass,
            isActive: true,
            $or: [{ students: socket.data.user._id }, { _id: socket.data.user.studentClass }],
          }));
        } else if (socket.data.user.role === "teacher") {
          const subjects = await Subject.find({ teacher: socket.data.user._id, isActive: true }).select("_id").lean();
          canAccess = Boolean(await Class.exists({
            _id: announcement.targetClass,
            $or: [{ adviser: socket.data.user._id }, { subjects: { $in: subjects.map((subject) => subject._id) } }],
          }));
        }
      }

      if (!canAccess) {
        callback?.({ ok: false, message: "Not authorized" });
        return;
      }
      socket.join(`announcement:${announcementId}`);
      callback?.({ ok: true });
    });

    socket.on("announcement:leave", (announcementId: string) => socket.leave(`announcement:${announcementId}`));

    socket.on("typing:start", (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit("typing:update", { conversationId, userId, name: socket.data.user.name, typing: true });
    });

    socket.on("typing:stop", (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit("typing:update", { conversationId, userId, typing: false });
    });

    socket.on("message:read", async ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      const conversation = await Conversation.findById(conversationId).select("members");
      if (!conversation?.members.some((member) => member.toString() === userId)) return;
      await Message.findOneAndUpdate({ _id: messageId, conversation: conversationId }, { $addToSet: { readBy: socket.data.user._id } });
      io?.to(`conversation:${conversationId}`).emit("message:read", { conversationId, messageId, userId });
    });

    socket.on("disconnect", () => {
      void broadcastPresence(false);
    });
  });

  return io;
};

export const closeRealtime = async () => {
  if (!io) {
    return;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      io!.close((error) => {
        if (error) {
          if ((error as NodeJS.ErrnoException).code === "ERR_SERVER_NOT_RUNNING") {
            resolve();
            return;
          }
          reject(error);
          return;
        }
        resolve();
      });
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ERR_SERVER_NOT_RUNNING") {
      throw error;
    }
  } finally {
    io = null;
  }
};

export const emitToConversation = (conversationId: string, event: string, payload: unknown) => {
  io?.to(`conversation:${conversationId}`).emit(event, payload);
};

export const emitToAnnouncement = (announcementId: string, event: string, payload: unknown) => {
  io?.to(`announcement:${announcementId}`).emit(event, payload);
};
export const emitAcademicUpdate = (payload: { classId?: string; kind: "exam" | "classwork" | "submission" }) => {
  io?.emit("academic:update", payload);
};
