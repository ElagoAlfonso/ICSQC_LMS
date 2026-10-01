import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { io, type Socket } from "socket.io-client";
import {
  ArrowLeft,
  CornerUpLeft,
  Edit3,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings,
  Smile,
  UserMinus,
  UserPlus,
  LogOut,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button, Card, Input, Select } from "../../components/ui";
import { classesApi, messagesApi } from "../../utils/api";
import { useAuthStore } from "../../store/authStore";
import type { Class, Conversation, Message, User } from "../../types";

const REACTIONS = ["👍", "❤️", "😂", "😮", "🎉", "👏", "🙏", "💯"];
const REACTION_PICKER_WIDTH = 300;

const idOf = (value: any) => (typeof value === "object" ? value?._id : value);
const nameOf = (value: any) =>
  typeof value === "object" ? value?.name : "User";

interface MessagesPageProps {
  compact?: boolean;
  onIncomingMessage?: (message: Message) => void;
  initialParticipant?: User | null;
  onParticipantOpened?: () => void;
}

export default function MessagesPage({ compact = false, onIncomingMessage, initialParticipant, onParticipantOpened }: MessagesPageProps) {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [search, setSearch] = useState("");
  const [showContacts, setShowContacts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingName, setTypingName] = useState("");
  const [peerOnline, setPeerOnline] = useState<boolean | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "reconnecting" | "offline">("connecting");
  const [reactionMenu, setReactionMenu] = useState<string | null>(null);
  const [reactionAnchor, setReactionAnchor] = useState<{ top: number; left: number } | null>(null);
  const [composerEmojiMenu, setComposerEmojiMenu] = useState(false);
  const [touchActions, setTouchActions] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [groupPhoto, setGroupPhoto] = useState<File | null>(null);
  const [groupName, setGroupName] = useState("");
  const [addMemberId, setAddMemberId] = useState("");
  const [savingGroupSettings, setSavingGroupSettings] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const scrollToNewestRef = useRef(false);
  const loadConversations = async (keepSelection = true) => {
    try {
      const response = await messagesApi.getConversations({
        search: search || undefined,
      });
      const items = (response.data.conversations || []) as Conversation[];
      setConversations(items);
      if (keepSelection && selected) {
        const refreshed = items.find((item) => item._id === selected._id);
        if (refreshed) setSelected(refreshed);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Unable to load messages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations(false);
    classesApi
      .getAll({ limit: 100 })
      .then((response) => setClasses(response.data.classes || []))
      .catch(() => undefined);
    const realtime = io(import.meta.env.VITE_REALTIME_URL || window.location.origin, {
      withCredentials: true,
    });
    realtime.on("connect", () => setConnectionStatus("connected"));
    realtime.on("disconnect", () => setConnectionStatus(realtime.active ? "reconnecting" : "offline"));
    realtime.on("connect_error", () => setConnectionStatus(realtime.active ? "reconnecting" : "offline"));
    realtime.io.on("reconnect_attempt", () => setConnectionStatus("reconnecting"));
    realtime.io.on("reconnect_error", () => setConnectionStatus("reconnecting"));
    realtime.io.on("reconnect_failed", () => setConnectionStatus("offline"));
    setSocket(realtime);
    return () => {
      realtime.disconnect();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadConversations(false), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!initialParticipant) return;
    void openPrivateChat(initialParticipant);
    onParticipantOpened?.();
  }, [initialParticipant]);

  useEffect(() => {
    if (!selected) return;
    scrollToNewestRef.current = true;
    nearBottomRef.current = true;
    const loadMessages = async () => {
      try {
        const response = await messagesApi.getMessages(selected._id);
        const loadedMessages = (response.data.messages || []) as Message[];
        setMessages(loadedMessages);
        loadedMessages.forEach((message) => {
          if (idOf(message.sender) !== user?._id && !(message.readBy || []).some((reader) => idOf(reader) === user?._id)) {
            socket?.emit("message:read", { conversationId: selected._id, messageId: message._id });
          }
        });
      } catch (error: any) {
        toast.error(
          error.response?.data?.message || "Unable to load conversation.",
        );
      }
    };
    loadMessages();
    socket?.emit("conversation:join", selected._id);
    return () => {
      socket?.emit("conversation:leave", selected._id);
    };
  }, [selected?._id, socket]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (message: Message) => {
      if (idOf(message.sender) !== user?._id) onIncomingMessage?.(message);
      if (idOf(message.conversation) !== selected?._id) return;
      setMessages((current) =>
        current.some((item) => item._id === message._id)
          ? current
          : [...current, message],
      );
      if (idOf(message.sender) !== user?._id && selected)
        socket.emit("message:read", {
          conversationId: selected._id,
          messageId: message._id,
        });
      loadConversations();
    };
    const onTyping = (event: {
      conversationId: string;
      userId: string;
      name?: string;
      typing: boolean;
    }) => {
      if (event.conversationId === selected?._id && event.userId !== user?._id)
        setTypingName(event.typing ? event.name || "Someone" : "");
    };
    const onPresence = (event: { userId: string; online: boolean }) => {
      const isPeer = selected?.members?.some(
        (member) => idOf(member) === event.userId && event.userId !== user?._id,
      );
      if (isPeer) setPeerOnline(event.online);
    };
    const onReaction = (event: {
      messageId: string;
      reactions: NonNullable<Message["reactions"]>;
    }) => {
      setMessages((current) =>
        current.map((message) =>
          message._id === event.messageId
            ? { ...message, reactions: event.reactions }
            : message,
        ),
      );
    };
    const onMessageUpdated = (message: Message) => {
      setMessages((current) => current.map((item) => item._id === message._id ? message : item));
    };
    const onMessageDeleted = (event: { messageId: string }) => {
      setMessages((current) => current
        .filter((item) => item._id !== event.messageId)
        .map((item) => item.replyTo?.replyToMessageId === event.messageId
          ? { ...item, replyTo: { ...item.replyTo, replyToText: undefined } }
          : item));
    };
    const onMessageRead = (event: { messageId: string; userId: string }) => {
      setMessages((current) => current.map((message) => message._id === event.messageId && !(message.readBy || []).some((reader) => idOf(reader) === event.userId)
        ? { ...message, readBy: [...(message.readBy || []).map((reader) => idOf(reader) as string), event.userId] }
        : message));
    };
    socket.on("message:new", onMessage);
    socket.on("typing:update", onTyping);
    socket.on("presence:update", onPresence);
    socket.on("reaction:updated", onReaction);
    socket.on("message:updated", onMessageUpdated);
    socket.on("message:deleted", onMessageDeleted);
    socket.on("message:read", onMessageRead);
    return () => {
      socket.off("message:new", onMessage);
      socket.off("typing:update", onTyping);
      socket.off("presence:update", onPresence);
      socket.off("reaction:updated", onReaction);
      socket.off("message:updated", onMessageUpdated);
      socket.off("message:deleted", onMessageDeleted);
      socket.off("message:read", onMessageRead);
    };
  }, [socket, selected?._id, user?._id, onIncomingMessage]);

  useEffect(() => {
    if (!socket || !selected) return;
    setPeerOnline(null);
    let stopTimer: number | undefined;
    const handleTyping = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement &&
        event.target.value.trim() !== ""
      ) {
        socket.emit("typing:start", selected._id);
        window.clearTimeout(stopTimer);
        stopTimer = window.setTimeout(
          () => socket.emit("typing:stop", selected._id),
          900,
        );
      }
    };
    document.addEventListener("keyup", handleTyping);
    return () => {
      document.removeEventListener("keyup", handleTyping);
      window.clearTimeout(stopTimer);
    };
  }, [socket, selected?._id]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || messages.length === 0) return;
    if (scrollToNewestRef.current || nearBottomRef.current) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: scrollToNewestRef.current ? "auto" : "smooth",
      });
      scrollToNewestRef.current = false;
    }
  }, [messages]);

  const contacts = useMemo(() => {
    const unique = new Map<string, User>();
    classes.forEach((classDoc) => {
      const members = [...(classDoc.students || []), classDoc.adviser].filter(
        Boolean,
      ) as User[];
      members.forEach((member) => {
        if (member._id && member._id !== user?._id)
          unique.set(member._id, member);
      });
    });
    return Array.from(unique.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [classes, user?._id]);

  const openClassChat = async (classId: string) => {
    try {
      const response = await messagesApi.getClassChat(classId);
      const conversation = response.data.conversation as Conversation;
      setSelected(conversation);
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item._id !== conversation._id),
      ]);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Unable to open class chat.",
      );
    }
  };

  const openPrivateChat = async (participant: User) => {
    try {
      const response = await messagesApi.createPrivate({
        participantId: participant._id,
        type: "private_user",
      });
      const conversation = response.data.conversation as Conversation;
      setSelected(conversation);
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item._id !== conversation._id),
      ]);
      setShowContacts(false);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Unable to start conversation.",
      );
    }
  };

  const send = async () => {
    if (!selected || (!text.trim() && files.length === 0) || sending) return;
    const clientMessageId = crypto.randomUUID();
    setSending(true);
    try {
      const payload = new FormData();
      payload.append("text", text.trim());
      payload.append("clientMessageId", clientMessageId);
      if (replyingTo?._id) payload.append("replyToMessageId", replyingTo._id);
      files.forEach((file) => payload.append("attachments", file));
      const response = editingMessage
        ? await messagesApi.editMessage(selected._id, editingMessage._id, { text: text.trim() })
        : await messagesApi.sendMessage(selected._id, payload);
      const sent = (response.data.message || response.data) as Message;
      setMessages((current) =>
        current.some((message) => message._id === sent._id)
          ? current.map((message) =>
              message._id === sent._id ? sent : message,
            )
          : [...current, sent],
      );
      setText("");
      setFiles([]);
      setReplyingTo(null);
      setEditingMessage(null);
      socket?.emit("typing:stop", selected._id);
      await loadConversations();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  const startReply = (message: Message) => {
    setEditingMessage(null);
    setReplyingTo(message);
    setText("");
  };

  const startEdit = (message: Message) => {
    setReplyingTo(null);
    setEditingMessage(message);
    setText(message.text);
  };

  const cancelComposerMode = () => {
    setReplyingTo(null);
    setEditingMessage(null);
    setText("");
  };

  const saveGroupSettings = async () => {
    if (!selected || selected.type !== "class_group" || savingGroupSettings) return;
    setSavingGroupSettings(true);
    try {
      const payload = new FormData();
      if (user?.role === "teacher" || user?.role === "admin") {
        payload.append("announcementOnly", String(Boolean(selected.announcementOnly)));
        payload.append("name", groupName.trim());
      }
      if (groupPhoto) payload.append("groupPhoto", groupPhoto);
      const response = await messagesApi.updateGroupSettings(selected._id, payload);
      const updated = response.data.conversation as Conversation;
      setSelected(updated);
      setConversations((current) => current.map((conversation) => conversation._id === updated._id ? updated : conversation));
      setGroupPhoto(null);
      setGroupSettingsOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Unable to update group settings.");
    } finally {
      setSavingGroupSettings(false);
    }
  };

  const openGroupSettings = () => {
    if (!selected) return;
    setGroupName(selected.name || "");
    setGroupPhoto(null);
    setGroupSettingsOpen((value) => !value);
  };

  const updateSelectedConversation = (updated: Conversation) => {
    setSelected(updated);
    setConversations((current) => current.map((conversation) => conversation._id === updated._id ? updated : conversation));
  };

  const addMember = async () => {
    if (!selected || !addMemberId) return;
    try {
      const response = await messagesApi.addGroupMember(selected._id, addMemberId);
      updateSelectedConversation(response.data.conversation as Conversation);
      setAddMemberId("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Unable to add classmate.");
    }
  };

  const removeMember = async (memberId: string) => {
    if (!selected || !window.confirm("Remove this student from the group chat?")) return;
    try {
      const response = await messagesApi.removeGroupMember(selected._id, memberId);
      updateSelectedConversation(response.data.conversation as Conversation);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Unable to remove student.");
    }
  };

  const leaveGroup = async () => {
    if (!selected || !window.confirm("Leave this group chat?")) return;
    try {
      await messagesApi.leaveGroup(selected._id);
      setConversations((current) => current.filter((conversation) => conversation._id !== selected._id));
      setSelected(null);
      setGroupSettingsOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Unable to leave group chat.");
    }
  };

  const groupPhotoUrl = selected?.type === "class_group" && selected.icon
    ? selected.icon.startsWith("http") ? selected.icon : `${messagesApi.getGroupPhotoUrl(selected._id)}?v=${encodeURIComponent(selected.updatedAt)}`
    : null;
  const canManageGroup = user?.role === "teacher" || user?.role === "admin";
  const currentMemberIds = new Set((selected?.members || []).map((member) => idOf(member)));
  const addableClassmates = contacts.filter((contact) => contact.role === "student" && !currentMemberIds.has(contact._id));

  const react = async (message: Message, emoji: string) => {
    if (!selected) return;
    try {
      const ownReaction = (message.reactions || []).find(
        (reaction) => idOf(reaction.userId) === user?._id,
      );
      if (ownReaction?.emoji === emoji) {
        await messagesApi.removeReaction(selected._id, message._id, { emoji });
      } else {
        if (ownReaction) {
          await messagesApi.removeReaction(selected._id, message._id, {
            emoji: ownReaction.emoji,
          });
        }
        await messagesApi.addReaction(selected._id, message._id, { emoji });
      }
      setReactionMenu(null);
      setReactionAnchor(null);
      const response = await messagesApi.getMessages(selected._id);
      setMessages(response.data.messages || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Unable to add reaction.");
    }
  };

  const toggleReactionMenu = (event: React.MouseEvent<HTMLButtonElement>, messageId: string, outgoing: boolean) => {
    if (reactionMenu === messageId) {
      setReactionMenu(null);
      setReactionAnchor(null);
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const pickerHeight = 54;
    const pickerWidth = Math.min(REACTION_PICKER_WIDTH, window.innerWidth - 16);
    const top = bounds.top - pickerHeight - 8 >= 8
      ? bounds.top - pickerHeight - 8
      : Math.min(bounds.bottom + 8, window.innerHeight - pickerHeight - 8);
    const left = Math.max(8, Math.min(
      outgoing ? bounds.right - pickerWidth : bounds.left,
      window.innerWidth - pickerWidth - 8,
    ));
    setReactionAnchor({ top: Math.max(8, top), left });
    setReactionMenu(messageId);
  };

  const remove = async (message: Message) => {
    if (!selected || !window.confirm("Delete this message?")) return;
    try {
      await messagesApi.deleteMessage(selected._id, message._id);
      setMessages((current) =>
        current.filter((item) => item._id !== message._id),
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Unable to delete message.");
    }
  };

  return (
    <div style={{ position: "relative", height: "100%", minHeight: 0 }}>
      <style>{`
        .message-action-control { opacity: 10; pointer-events: none; transition: opacity 0.15s ease; }
        .message-row:hover .message-action-control, .message-row:focus-within .message-action-control, .message-row.touch-actions .message-action-control { opacity: 1; pointer-events: auto; }
        .message-row.is-grouped { margin-top: -6px; }
        .message-row.is-grouped .message-sender { visibility: hidden; height: 0; margin: 0; overflow: hidden; }
        .message-reaction-badges { position: absolute; bottom: -11px; display: flex; align-items: center; flex-wrap: wrap; gap: 2px; max-width: calc(100% - 12px); overflow: hidden; padding: 1px 5px; border: 1px solid #E2E8F0; border-radius: 999px; background: #fff; box-shadow: 0 2px 6px rgba(15,23,42,0.1); font-size: 13px; line-height: 15px; white-space: normal; z-index: 2; }
        .message-reaction-badges.outgoing { right: 6px; }
        .message-reaction-badges.incoming { left: 6px; }
        .reaction-picker.outgoing::after { content: "←"; position: absolute; right: -15px; top: 7px; color: #64748B; font-size: 0.85rem; }
        .reaction-picker.incoming::after { content: "→"; position: absolute; left: -15px; top: 7px; color: #64748B; font-size: 0.85rem; }
        .group-options-grid { grid-template-columns: minmax(120px, 0.7fr) minmax(0, 1.3fr); }
        @media (max-width: 620px) {
          .messenger-shell.compact { grid-template-columns: 1fr !important; }
          .messenger-shell.compact .compact-list-hidden, .messenger-shell.compact .compact-chat-hidden { display: none !important; }
          .messenger-shell.compact .compact-back { display: grid !important; place-items: center; }
          .message-reaction-badges { max-width: calc(100% - 12px); }
          .group-options-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {typingName && (
        <div
          style={{
            position: "fixed",
            bottom: 78,
            right: 28,
            zIndex: 5,
            padding: "6px 10px",
            borderRadius: 12,
            background: "#fff",
            color: "#64748B",
            fontSize: "0.75rem",
            fontStyle: "italic",
            boxShadow: "0 2px 10px rgba(15,23,42,0.12)",
          }}
        >
          {typingName} is typing...
        </div>
      )}
      {peerOnline !== null && selected?.type !== "class_group" && (
        <div
          style={{
            position: "fixed",
            bottom: 48,
            right: 28,
            zIndex: 5,
            padding: "6px 10px",
            borderRadius: 12,
            background: "#fff",
            color: peerOnline ? "#059669" : "#94A3B8",
            fontSize: "0.75rem",
            boxShadow: "0 2px 10px rgba(15,23,42,0.12)",
          }}
        >
          {peerOnline ? "Online" : "Offline"}
        </div>
      )}
      <div
        className={`messenger-shell${compact ? " compact" : ""}${selected ? " has-selection" : ""}`}
        style={{
          height: compact ? "100%" : "calc(100vh - var(--topbar-height) - 56px)",
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: compact ? "224px minmax(0, 1fr)" : "minmax(260px, 340px) minmax(0, 1fr)",
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
          <aside
            className={compact && selected ? "compact-list-hidden" : undefined}
          style={{
            borderRight: "1px solid #E5E7EB",
            display: selected ? "flex" : "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div style={{ padding: 18, borderBottom: "1px solid #E5E7EB" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "1.25rem",
                    color: "var(--gray-900)",
                  }}
                >
                  Messages
                </h1>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "0.78rem",
                    color: "#64748B",
                  }}
                >
                  Private and class conversations
                </p>
              </div>
              <Button
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setShowContacts((value) => !value)}
                aria-label="New conversation"
              />
            </div>
            <div style={{ position: "relative", marginTop: 14 }}>
              <Search
                size={15}
                style={{
                  position: "absolute",
                  left: 11,
                  top: 11,
                  color: "#94A3B8",
                }}
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations..."
                style={{
                  width: "100%",
                  minWidth: 0,
                  boxSizing: "border-box",
                  padding: "9px 12px 9px 34px",
                  border: "1px solid #E5E7EB",
                  borderRadius: 9,
                  outline: "none",
                }}
              />
            </div>
          </div>
          {showContacts && (
            <div
              style={{
                padding: 14,
                borderBottom: "1px solid #E5E7EB",
                background: "#FFF7F7",
                display: "grid",
                gap: 10,
              }}
            >
              <Select
                label="Start private chat"
                options={[
                  { value: "", label: "Choose a person" },
                  ...contacts.map((contact) => ({
                    value: contact._id,
                    label: `${contact.name} (${contact.role})`,
                  })),
                ]}
                onChange={(event) => {
                  const contact = contacts.find(
                    (item) => item._id === event.target.value,
                  );
                  if (contact) openPrivateChat(contact);
                }}
              />
              <div style={{ display: "grid", gap: 6 }}>
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                >
                  Class group chats
                </span>
                {classes.map((classDoc) => (
                  <button
                    key={classDoc._id}
                    type="button"
                    onClick={() => openClassChat(classDoc._id)}
                    style={{
                      textAlign: "left",
                      border: "1px solid #E5E7EB",
                      background: "#fff",
                      padding: "8px 10px",
                      borderRadius: 8,
                      cursor: "pointer",
                      color: "#334155",
                    }}
                  >
                    <Users
                      size={13}
                      style={{ verticalAlign: "middle", marginRight: 6 }}
                    />
                    {classDoc.name} - {classDoc.section}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading ? (
              <p style={{ padding: 18, color: "#64748B" }}>
                Loading conversations...
              </p>
            ) : conversations.length === 0 ? (
              <p style={{ padding: 18, color: "#64748B" }}>
                No conversations yet.
              </p>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation._id}
                  type="button"
                  onClick={() => { setSelected(conversation); setGroupSettingsOpen(false); }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    display: "flex",
                    gap: 10,
                    padding: "14px 16px",
                    border: 0,
                    borderBottom: "1px solid #F1F5F9",
                    background:
                      selected?._id === conversation._id ? "#FFF7F7" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      background:
                        conversation.type === "class_group"
                          ? "#FDE68A"
                          : "#FEE2E2",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      color: "#7a1010",
                    }}
                  >
                    {conversation.type === "class_group" && conversation.icon ? (
                      <img src={conversation.icon.startsWith("http") ? conversation.icon : messagesApi.getGroupPhotoUrl(conversation._id)} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                    ) : conversation.type === "class_group" ? (
                      <Users size={17} />
                    ) : (
                      <MessageCircle size={17} />
                    )}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <strong
                        style={{
                          minWidth: 0,
                          flex: 1,
                          fontSize: "0.86rem",
                          color: "#1F2937",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {conversation.name ||
                          conversation.members
                            ?.filter((member) => idOf(member) !== user?._id)
                            .map(nameOf)
                            .join(", ") ||
                          "Conversation"}
                      </strong>
                      <span style={{ flexShrink: 0, whiteSpace: "nowrap", fontSize: "0.68rem", color: "#94A3B8" }}>
                        {conversation.lastMessageAt
                          ? new Date(
                              conversation.lastMessageAt,
                            ).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        color: "#64748B",
                        fontSize: "0.75rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {conversation.lastMessagePreview || "No messages yet"}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <main
          className={compact && !selected ? "compact-chat-hidden" : undefined}
          style={{
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            background: "#FAFAFA",
            overflow: "hidden",
          }}
        >
          {!selected ? (
            <div
              style={{
                flex: 1,
                display: "grid",
                placeItems: "center",
                color: "#64748B",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <MessageCircle size={42} color="#CBD5E1" />
                <p>Select a conversation to start messaging.</p>
              </div>
            </div>
          ) : (
            <>
              <header
                style={{
                  flexShrink: 0,
                  padding: "14px 18px",
                  background: "#fff",
                  borderBottom: "1px solid #E5E7EB",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="compact-back"
                  style={{
                    display: "none",
                    border: 0,
                    background: "none",
                    color: "#7a1010",
                  }}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={18} />
                </button>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background:
                      selected.type === "class_group" ? "#FDE68A" : "#FEE2E2",
                    display: "grid",
                    placeItems: "center",
                    color: "#7a1010",
                  }}
                >
                  {groupPhotoUrl ? (
                    <img src={groupPhotoUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  ) : selected.type === "class_group" ? (
                    <Users size={17} />
                  ) : (
                    <MessageCircle size={17} />
                  )}
                </div>
                <div>
                  <strong style={{ color: "#1F2937" }}>
                    {selected.name ||
                      selected.members
                        ?.filter((member) => idOf(member) !== user?._id)
                        .map(nameOf)
                        .join(", ") ||
                      "Conversation"}
                  </strong>
                  <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                    {selected.type === "class_group"
                      ? `${selected.members?.length || 0} members`
                      : "Private conversation"}
                  </div>
                </div>
                {selected.type === "class_group" && <button type="button" onClick={openGroupSettings} aria-label="Group chat settings" title="Group chat settings" style={{ marginLeft: "auto", border: 0, background: "transparent", color: "#64748B", cursor: "pointer" }}><Settings size={17} /></button>}
                {connectionStatus !== "connected" && <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: connectionStatus === "offline" ? "#DC2626" : "#D97706" }}>{connectionStatus === "offline" ? "Offline" : connectionStatus === "reconnecting" ? "Reconnecting..." : "Connecting..."}</span>}
              </header>
              {groupSettingsOpen && selected.type === "class_group" && (
                <section style={{ flexShrink: 0, maxHeight: "min(330px, 48vh)", overflowY: "auto", background: "#fff", borderBottom: "1px solid #E5E7EB", color: "#334155" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid #E5E7EB", fontSize: "0.72rem", fontWeight: 700, color: "#1F2937" }}>Group options</div>
                  <div className="group-options-grid" style={{ padding: "14px", display: "grid", gap: 14 }}>
                    <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
                      <label title="Choose group photo" style={{ position: "relative", width: 58, height: 58, borderRadius: "50%", display: "grid", placeItems: "center", background: groupPhotoUrl ? "#fff" : "#34BFA3", color: "#fff", cursor: "pointer", overflow: "hidden", boxShadow: "0 2px 6px rgba(15,23,42,0.12)" }}>
                        {groupPhotoUrl ? <img src={groupPhotoUrl} alt="Current group" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Users size={22} />}
                        <input type="file" accept="image/*" onChange={(event) => setGroupPhoto(event.target.files?.[0] || null)} style={{ display: "none" }} />
                      </label>
                      <strong style={{ fontSize: "0.8rem", color: "#111827" }}>{selected.name || "Group chat"}</strong>
                      <span style={{ fontSize: "0.7rem", color: "#64748B" }}>{selected.members?.length || 0} members</span>
                    </div>
                    {canManageGroup && <label style={{ display: "grid", gap: 5, fontSize: "0.7rem", fontWeight: 600, color: "#334155" }}>
                      Group name
                      <input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={100} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid #D7DCE3", borderRadius: 3, fontSize: "0.75rem", outline: "none" }} />
                    </label>}
                    {canManageGroup && <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem", color: "#475569" }}>
                      <input type="checkbox" checked={Boolean(selected.announcementOnly)} onChange={(event) => setSelected({ ...selected, announcementOnly: event.target.checked })} />
                      Announcement-only mode
                    </label>}
                    <div style={{ display: "flex", gap: 6, alignItems: "end" }}>
                      <label style={{ display: "grid", flex: 1, gap: 5, fontSize: "0.7rem", fontWeight: 600, color: "#334155" }}>
                        Add classmate
                        <select value={addMemberId} onChange={(event) => setAddMemberId(event.target.value)} style={{ minWidth: 0, padding: "8px 10px", border: "1px solid #D7DCE3", borderRadius: 3, fontSize: "0.75rem", background: "#fff" }}>
                          <option value="">Choose a student</option>
                          {addableClassmates.map((contact) => <option key={contact._id} value={contact._id}>{contact.name}</option>)}
                        </select>
                      </label>
                      <Button type="button" size="sm" icon={<UserPlus size={14} />} onClick={addMember} disabled={!addMemberId} aria-label="Add classmate" />
                    </div>
                    <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 10 }}>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, marginBottom: 7 }}>Members ({selected.members?.length || 0})</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {(selected.members || []).map((member, index) => {
                          const memberUser = typeof member === "object" ? member : null;
                          const memberName = memberUser?.name || "Member";
                          return <div key={memberUser?._id || String(member) || index} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem" }}><div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", display: "grid", placeItems: "center", background: "#E2E8F0", color: "#475569", fontSize: "0.65rem", fontWeight: 700 }}>{memberUser?.profileImage ? <img src={memberUser.profileImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : memberName.slice(0, 1).toUpperCase()}</div><span style={{ flex: 1 }}>{memberName}</span>{canManageGroup && memberUser?.role === "student" && <button type="button" onClick={() => removeMember(memberUser._id)} aria-label={`Remove ${memberName}`} title="Remove student" style={{ border: 0, background: "transparent", color: "#94A3B8", cursor: "pointer" }}><UserMinus size={14} /></button>}</div>;
                        })}
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <Button type="button" size="sm" variant="danger" icon={<LogOut size={14} />} onClick={leaveGroup}>Leave group</Button>
                      <Button type="button" size="sm" loading={savingGroupSettings} onClick={saveGroupSettings}>Save changes</Button>
                    </div>
                  </div>
                </section>
              )}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
                ref={messagesContainerRef}
                onScroll={(event) => {
                  const container = event.currentTarget;
                  nearBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight <= 120;
                }}
              >
                {messages.map((message, messageIndex) => {
                  const outgoing = idOf(message.sender) === user?._id;
                  const previousMessage = messages[messageIndex - 1];
                  const grouped = Boolean(previousMessage && idOf(previousMessage.sender) === idOf(message.sender) && new Date(message.createdAt).getTime() - new Date(previousMessage.createdAt).getTime() <= 5 * 60 * 1000);
                  return (
                    <div
                      key={message._id}
                      className={`message-row${grouped ? " is-grouped" : ""}${touchActions === message._id ? " touch-actions" : ""}`}
                      onTouchStart={() => { const timer = window.setTimeout(() => setTouchActions(message._id), 450); (message as any).__touchTimer = timer; }}
                      onTouchEnd={() => { window.clearTimeout((message as any).__touchTimer); }}
                      onTouchCancel={() => { window.clearTimeout((message as any).__touchTimer); }}
                      style={{
                        alignSelf: outgoing ? "flex-end" : "flex-start",
                        maxWidth: "min(75%, 560px)",
                        display: "grid",
                        gap: grouped ? 2 : 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: "#64748B",
                          textAlign: outgoing ? "right" : "left",
                        }}
                      >
                        <span className="message-sender">{outgoing ? "You" : nameOf(message.sender)}{" "}
                        {message.isEdited ? "(edited)" : ""}
                        </span>
                      </div>
                      <div
                        style={{
                          position: "relative",
                          background: outgoing ? "#256B68" : "#fff",
                          color: outgoing ? "#fff" : "#334155",
                          padding: "5px 10px",
                          borderRadius: outgoing
                            ? "16px 16px 4px 16px"
                            : "16px 16px 16px 4px",
                          boxShadow: "0 1px 2px rgba(15,23,42,0.08)",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          marginBottom: message.reactions?.length ? 12 : 0,
                        }}
                      >
                        {message.replyTo && (
                          <div
                            style={{
                              borderLeft: "3px solid currentColor",
                              opacity: 0.75,
                              paddingLeft: 8,
                              marginBottom: 6,
                              fontSize: "0.75rem",
                            }}
                          >
                            {message.replyTo.replyToText || "This message was deleted."}
                          </div>
                        )}
                        {message.text}
                        {message.attachments?.map((attachment) => {
                          const attachmentUrl = `/api/messages/${idOf(message.conversation)}/messages/${message._id}/attachments/${attachment._id}`;
                          const isImage = attachment.mimeType?.startsWith("image/");
                          return isImage ? (
                            <a key={attachment._id} href={attachmentUrl} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 8 }}>
                              <img src={attachmentUrl} alt={attachment.originalName} style={{ display: "block", maxWidth: 200, maxHeight: 160, borderRadius: 8, objectFit: "cover" }} />
                            </a>
                          ) : (
                            <a key={attachment._id} href={`${attachmentUrl}?download=1`} style={{ display: "block", marginTop: 8, color: outgoing ? "#fff" : "#7a1010", fontSize: "0.75rem", textDecoration: "underline" }}>
                              {attachment.originalName}
                            </a>
                          );
                        })}
                        {(message.reactions || []).length > 0 && <div className={`message-reaction-badges ${outgoing ? "outgoing" : "incoming"}`}>{Array.from(new Set((message.reactions || []).map((reaction) => reaction.emoji))).map((emoji) => <span key={emoji}>{emoji}</span>)}</div>}
                      </div>
                      <div
                        className="message-footer"
                        style={{
                          display: "flex",
                          gap: 4,
                          justifyContent: outgoing ? "flex-end" : "flex-start",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: "0.65rem", color: "#94A3B8" }}>
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        {outgoing && (message.readBy || []).length > 0 && <span style={{ fontSize: "0.65rem", color: "#059669" }}>Seen</span>}
                        <button
                          className="message-action-control"
                          type="button"
                          onClick={() => startReply(message)}
                          aria-label="Reply to message"
                          style={{ border: 0, background: "transparent", color: "#64748B", cursor: "pointer" }}
                        >
                          <CornerUpLeft size={13} />
                        </button>
                        <div className={`message-action-control reaction-picker ${outgoing ? "outgoing" : "incoming"}`} style={{ position: "relative" }}>
                          <button
                            type="button"
                            onClick={(event) => toggleReactionMenu(event, message._id, outgoing)}
                            aria-label="React to message"
                            style={{
                              border: 0,
                              background: "#fff",
                              borderRadius: 10,
                              cursor: "pointer",
                              fontSize: "0.72rem",
                            }}
                          >
                            +
                          </button>
                          {reactionMenu === message._id && reactionAnchor && createPortal(
                            <div
                              style={{
                                position: "fixed",
                                top: reactionAnchor.top,
                                left: reactionAnchor.left,
                                display: "flex",
                                flexDirection: "row",
                                gap: 3,
                                padding: 5,
                                background: "#fff",
                                border: "1px solid #E5E7EB",
                                borderRadius: 10,
                                boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
                                zIndex: 20,
                                width: "min(300px, calc(100vw - 16px))",
                              }}
                            >
                              {REACTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => react(message, emoji)}
                                  aria-label={`React ${emoji}`}
                                  style={{
                                    border: 0,
                                    background: "transparent",
                                    cursor: "pointer",
                                    fontSize: "1rem",
                                    width: "clamp(24px, calc((100vw - 47px) / 8), 34px)",
                                    height: "clamp(28px, calc((100vw - 47px) / 8), 34px)",
                                    padding: 3,
                                  }}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>,
                            document.body,
                          )}
                        </div>
                        {outgoing && (
                          <>
                            <button className="message-action-control" type="button" onClick={() => startEdit(message)} aria-label="Edit message" style={{ border: 0, background: "transparent", color: "#64748B", cursor: "pointer" }}><Edit3 size={13} /></button>
                            <button className="message-action-control" type="button" onClick={() => remove(message)} aria-label="Delete message" style={{ border: 0, background: "transparent", color: "#94A3B8", cursor: "pointer" }}><MoreVertical size={14} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  send();
                }}
                style={{
                  flexShrink: 0,
                  position: "relative",
                  padding: 14,
                  background: "#fff",
                  borderTop: "1px solid #E5E7EB",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                {(replyingTo || editingMessage) && (
                  <div style={{ position: "absolute", transform: "translateY(-58px)", left: 14, right: 14, display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: "0.75rem", color: "#64748B" }}>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{editingMessage ? `Editing: ${editingMessage.text}` : `Replying to ${nameOf(replyingTo?.sender)}: ${replyingTo?.text}`}</span>
                    <button type="button" onClick={cancelComposerMode} aria-label="Cancel reply or edit" style={{ border: 0, background: "transparent", color: "#64748B", cursor: "pointer" }}>Cancel</button>
                  </div>
                )}
                <label
                  aria-label="Attach files"
                  title={editingMessage ? "Attachments cannot be changed while editing" : "Attach files"}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: editingMessage ? "#CBD5E1" : "#64748B",
                    cursor: editingMessage ? "not-allowed" : "pointer",
                  }}
                >
                  <Paperclip size={19} />
                  <input type="file" multiple disabled={Boolean(editingMessage)} accept=".pdf,.doc,.docx,.xlsx,.xls,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.bmp,.mp3,.wav,.mp4,.mov,.zip,.rar,.7z" onChange={(event) => setFiles(Array.from(event.target.files || []))} style={{ display: "none" }} />
                </label>
                <div style={{ position: "relative" }}>
                  <button type="button" aria-label="Emoji" onClick={() => setComposerEmojiMenu((value) => !value)} style={{ border: 0, background: "transparent", color: "#64748B", cursor: "pointer" }}><Smile size={19} /></button>
                  {composerEmojiMenu && <div style={{ position: "absolute", bottom: 30, left: 0, zIndex: 4, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, padding: 6, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 9, boxShadow: "0 4px 12px rgba(15,23,42,0.12)" }}>{["😀", "😂", "❤️", "👍", "🙏", "🎉", "😮", "👏"].map((emoji) => <button key={emoji} type="button" onClick={() => { setText((value) => `${value}${emoji}`); setComposerEmojiMenu(false); }} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: "1rem", padding: 3 }}>{emoji}</button>)}</div>}
                </div>
                {files.length > 0 && <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.7rem", color: "#64748B" }}>{files.length} file{files.length === 1 ? "" : "s"}</span>}
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={
                    selected.announcementOnly && user?.role !== "teacher"
                      ? "This chat is announcement-only"
                      : "Type a message..."
                  }
                  disabled={
                    selected.announcementOnly && user?.role !== "teacher"
                  }
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "10px 12px",
                    border: "1px solid #E5E7EB",
                    borderRadius: 20,
                    outline: "none",
                  }}
                />
                <Button
                  type="submit"
                  size="sm"
                  loading={sending}
                  disabled={
                    selected.announcementOnly && user?.role !== "teacher"
                  }
                  icon={<Send size={15} />}
                  aria-label="Send message"
                />
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}