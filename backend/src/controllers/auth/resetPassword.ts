import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import User from "../../models/user";
import { isStrongPassword, passwordRequirementsMessage } from "../../utils/authValidation";
import { hashResetToken } from "../../utils/generateResetToken";

const invalidLinkMessage = "Invalid password reset link.";
const expiredLinkMessage = "This password reset link has expired.";

export const verifyResetToken = async (req: Request, res: Response): Promise<void> => {
  const token = typeof req.params.token === "string" ? req.params.token : "";
  if (!token) {
    res.status(400).json({ success: false, message: invalidLinkMessage });
    return;
  }

  try {
    const hashedToken = hashResetToken(token);
    const user = await User.findOne({ resetPasswordToken: hashedToken })
      .select("+resetPasswordToken +resetPasswordExpire");
    if (!user) {
      res.status(400).json({ success: false, message: invalidLinkMessage });
      return;
    }
    if (!user.resetPasswordExpire || user.resetPasswordExpire <= new Date()) {
      res.status(400).json({ success: false, message: expiredLinkMessage });
      return;
    }

    res.json({ success: true, valid: true });
  } catch {
    console.error("Reset token verification failed.");
    res.status(500).json({ success: false, message: "Unable to verify this link. Please try again." });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { password, confirmPassword } = req.body ?? {};
  if (password !== confirmPassword) {
    res.status(400).json({ success: false, message: "Passwords do not match." });
    return;
  }
  if (!isStrongPassword(password)) {
    res.status(400).json({ success: false, message: passwordRequirementsMessage });
    return;
  }

  const token = typeof req.params.token === "string" ? req.params.token : "";
  if (!token) {
    res.status(400).json({ success: false, message: invalidLinkMessage });
    return;
  }

  try {
    const hashedToken = hashResetToken(token);
    const now = new Date();
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      { resetPasswordToken: hashedToken, resetPasswordExpire: { $gt: now } },
      {
        $set: { password: hashedPassword },
        $unset: { resetPasswordToken: 1, resetPasswordExpire: 1 },
      },
      { new: true },
    );

    if (!user) {
      const expiredUser = await User.findOne({ resetPasswordToken: hashedToken })
        .select("+resetPasswordToken +resetPasswordExpire");
      const message = expiredUser ? expiredLinkMessage : `${invalidLinkMessage} It may have already been used.`;
      res.status(400).json({ success: false, message });
      return;
    }

    res.json({ success: true, message: "Password has been reset successfully." });
  } catch {
    console.error("Password reset failed.");
    res.status(500).json({ success: false, message: "Unable to reset password. Please try again." });
  }
};