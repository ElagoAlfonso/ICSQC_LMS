import crypto from "node:crypto";

export const generateResetToken = (): { token: string; hashedToken: string } => {
  const token = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hashedToken };
};

export const hashResetToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");