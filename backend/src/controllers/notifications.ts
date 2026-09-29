import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth.ts";
import Notification from "../models/notification.ts";

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Not authorized" });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user!._id },
      { isRead: true },
      { new: true }
    );
    if (!notification) { res.status(404).json({ message: "Notification not found" }); return; }
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.updateMany({ recipient: req.user!._id, isRead: false }, { isRead: true });
    res.json({ message: "Notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};
