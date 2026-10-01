import jwt from "jsonwebtoken";
import { type Request, type Response, type NextFunction } from "express";

const isPlaceholderValue = (value?: string) => {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return [
    "your-google-oauth-client-id",
    "your-google-oauth-client-secret",
    "replace-with-a-long-random-secret",
    "your-google-cloud-project-id",
    "example",
    "todo",
    "changeme",
    "placeholder"
  ].includes(normalized);
};

const hasValidGoogleClientConfig = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();

  const clientIdLooksValid = Boolean(clientId) && !isPlaceholderValue(clientId) && /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(clientId!);
  const clientSecretLooksValid = Boolean(clientSecret) && !isPlaceholderValue(clientSecret) && clientSecret!.length >= 20;
  const redirectLooksValid = Boolean(redirectUri) && /^https?:\/\//i.test(redirectUri!);

  return clientIdLooksValid && clientSecretLooksValid && redirectLooksValid;
};

export const createGoogleOAuthState = (userId: string, role: "teacher" | "admin", classId?: string) => jwt.sign(
  { teacherId: userId, role, ...(classId ? { classId } : {}), purpose: "google-calendar-oauth" },
  process.env.JWT_SECRET as string,
  { expiresIn: "10m" }
);

export const verifyGoogleOAuthState = (state: string) => {
  const decoded = jwt.verify(state, process.env.JWT_SECRET as string) as { teacherId: string; role: "teacher" | "admin"; classId?: string; purpose: string };
  if (decoded.purpose !== "google-calendar-oauth" || !decoded.teacherId || !["teacher", "admin"].includes(decoded.role)) throw new Error("Invalid OAuth state");
  if (decoded.classId && !/^[a-f\d]{24}$/i.test(decoded.classId)) throw new Error("Invalid OAuth state");
  return decoded;
};

export const requireGoogleConfiguration = (_req: Request, res: Response, next: NextFunction) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI || !hasValidGoogleClientConfig()) {
    res.status(503).json({
      message: "Google Calendar integration is not configured with valid OAuth credentials. Update backend/.env with a real Google OAuth client ID, secret, and redirect URI."
    });
    return;
  }
  next();
};