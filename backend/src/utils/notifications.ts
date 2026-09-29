import mongoose from "mongoose";
import Notification, { type NotificationType } from "../models/notification.ts";

interface NotificationInput {
  recipient: mongoose.Types.ObjectId | string;
  title: string;
  message: string;
  type: NotificationType;
  relatedResource?: mongoose.Types.ObjectId | string;
  relatedClass?: mongoose.Types.ObjectId | string;
}

export const createNotification = (input: NotificationInput) =>
  Notification.create(input);

export const createNotifications = (recipients: mongoose.Types.ObjectId[] | string[], input: Omit<NotificationInput, "recipient">) =>
  Notification.insertMany(recipients.map((recipient) => ({ ...input, recipient })));
