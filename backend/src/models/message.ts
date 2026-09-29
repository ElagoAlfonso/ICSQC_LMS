import mongoose, { Schema, Document } from "mongoose";

export interface IMessageAttachment {
  originalName: string;
  storageName: string;
  storagePath: string;
  extension: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

export interface IMessageReaction {
  userId: mongoose.Types.ObjectId;
  emoji: string;
  createdAt: Date;
}

export interface IMessageReply {
  replyToMessageId: mongoose.Types.ObjectId;
  replyToText?: string;
  replyToAuthorName?: string;
}

export interface IMessage extends Document {
  // Relationships
  conversation: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  clientMessageId?: string;
  
  // Message Content
  text: string;
  attachments: IMessageAttachment[];
  
  // Replies/Threading
  replyTo?: IMessageReply;
  
  // Reactions
  reactions: IMessageReaction[];
  
  // Status
  isEdited: boolean;
  editedAt?: Date;
  editHistory?: string[]; // Previous versions of the message
  
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  
  // Read status
  readBy?: mongoose.Types.ObjectId[];
  readAt?: Date[];
  
  // Typing indicator state
  isTyping?: boolean;
}

const messageAttachmentSchema = new Schema<IMessageAttachment>({
  originalName: { type: String, required: true },
  storageName: { type: String, required: true },
  storagePath: { type: String, required: true },
  extension: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const messageReactionSchema = new Schema<IMessageReaction>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  emoji: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const messageReplySchema = new Schema<IMessageReply>({
  replyToMessageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
  replyToText: { type: String },
  replyToAuthorName: { type: String },
});

const messageSchema = new Schema<IMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    clientMessageId: { type: String },
    text: { type: String, required: true },
    attachments: [messageAttachmentSchema],
    replyTo: messageReplySchema,
    reactions: [messageReactionSchema],
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    editHistory: [{ type: String }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    readAt: [{ type: Date }],
    isTyping: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Create indexes for efficient querying
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ conversation: 1, clientMessageId: 1 }, { unique: true, sparse: true });
messageSchema.index({ isDeleted: 1 });

export default mongoose.model<IMessage>("Message", messageSchema);
