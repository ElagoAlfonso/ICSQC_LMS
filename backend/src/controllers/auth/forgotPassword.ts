import type { Request, Response } from "express";
import User from "../../models/user";
import { sendPasswordResetEmail } from "../../services/mailService";
import { generateResetToken } from "../../utils/generateResetToken";
import { isIcsqcEmail, normalizeEmail } from "../../utils/authValidation";

const genericResetMessage =
  "If an account with that email exists, a password reset link has been sent.";

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const email = normalizeEmail(req.body?.email);
  if (!isIcsqcEmail(email)) {
    res.status(400).json({ success: false, message: "Please enter a valid ICSQC email address." });
    return;
  }

  try {
    const user = await User.findOne({ email }).select("+resetPasswordToken +resetPasswordExpire");
    if (user) {
      const { token, hashedToken } = generateResetToken();
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();

      try {
        await sendPasswordResetEmail(user.email, user.name, token);
      } catch {
        console.error("Password reset email delivery failed.");
      }
    }

    res.json({ success: true, message: genericResetMessage });
  } catch {
    console.error("Forgot password request failed.");
    res.status(500).json({ success: false, message: "Unable to process the request. Please try again later." });
  }
};