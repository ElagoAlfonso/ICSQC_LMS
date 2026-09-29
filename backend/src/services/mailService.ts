import nodemailer, { type SendMailOptions } from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

const getTransporter = (): ReturnType<typeof nodemailer.createTransport> => {
  if (transporter) return transporter;

  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  if (!user || !pass) throw new Error("Email service is not configured.");

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = host
    ? nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
    : nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  return transporter;
};

export const sendEmail = (message: SendMailOptions) => getTransporter().sendMail(message);

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] as string);

export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  token: string,
): Promise<void> => {
  const configuredClientUrl = process.env.CLIENT_URL?.split(",").map((origin) => origin.trim()).find(Boolean);
  const clientUrl = (configuredClientUrl || (process.env.NODE_ENV === "development" ? "http://localhost:5173" : ""))
    .replace(/\/$/, "");
  if (!clientUrl) throw new Error("CLIENT_URL must be configured to send password reset links.");
  const resetUrl = `${clientUrl}/reset-password/${encodeURIComponent(token)}`;
  const user = process.env.EMAIL_USER || process.env.SMTP_USER;
  const from = process.env.EMAIL_FROM || user;
  const greeting = escapeHtml(name || "there");

  await sendEmail({
    from,
    to: email,
    subject: "ICSQC LMS Password Reset Request",
    text: [
      `Hello ${name || "there"},`,
      "",
      "We received a request to reset your ICSQC LMS password.",
      `Reset your password: ${resetUrl}`,
      "This link expires in 15 minutes and can only be used once.",
      "If you did not request this, you can safely ignore this email.",
      "",
      "International Christian School of Quezon City Learning Management System",
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:24px auto;padding:28px;color:#1f2937;border:1px solid #e5e7eb;border-radius:8px"><h1 style="margin:0 0 24px;color:#7a1010;font-size:22px">ICSQC LMS</h1><p>Hello ${greeting},</p><p>We received a request to reset your ICSQC LMS password. Use the button below to choose a new password.</p><p style="margin:28px 0"><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#7a1010;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Reset Password</a></p><p>This link expires in <strong>15 minutes</strong> and can only be used once.</p><p>If you did not request this, you can safely ignore this email.</p><p style="font-size:13px;color:#6b7280;word-break:break-all">If the button does not work, use this link:<br><a href="${resetUrl}" style="color:#7a1010">${resetUrl}</a></p><p style="margin-top:28px;font-size:13px;color:#6b7280">International Christian School of Quezon City Learning Management System</p></div>`,
  });
};