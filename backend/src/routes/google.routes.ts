import express from "express";
import { protect, authorize, type AuthRequest } from "../middleware/auth";
import { createGoogleOAuthState, requireGoogleConfiguration, verifyGoogleOAuthState } from "../middleware/googleAuth";
import { createOAuthClient, getGoogleAuthUrl, saveGoogleTokens } from "../services/googleMeet.service";
import GoogleToken from "../models/googleToken.model";

const router = express.Router();
router.get("/google/status", protect, authorize(["teacher", "admin"]), requireGoogleConfiguration, async (req: AuthRequest, res) => {
  const connected = Boolean(await GoogleToken.exists({ teacherId: req.user!._id }));
  res.json({ connected });
});

router.get("/google/auth", protect, authorize(["teacher", "admin"]), requireGoogleConfiguration, (req: AuthRequest, res) => {
  const role = req.user!.role === "admin" ? "admin" : "teacher";
  res.redirect(getGoogleAuthUrl(createGoogleOAuthState(req.user!._id.toString(), role)));
});

router.get("/google/callback", requireGoogleConfiguration, async (req, res) => {
  const clientUrl = process.env.CLIENT_URL?.split(",").map((origin) => origin.trim()).find(Boolean)
    || (process.env.NODE_ENV === "development" ? "http://localhost:5173" : undefined);
  if (!clientUrl) {
    res.status(503).json({ message: "Frontend URL is not configured." });
    return;
  }

  try {
    const { teacherId, role } = verifyGoogleOAuthState(String(req.query.state || ""));
    const client = createOAuthClient();
    const { tokens } = await client.getToken(String(req.query.code || ""));
    client.setCredentials(tokens);
    await saveGoogleTokens(teacherId, client);
    res.redirect(`${clientUrl}/${role}/dashboard?google=connected`);
  } catch (error: any) {
    const message = process.env.NODE_ENV === "development"
      ? error?.message || "Google authorization failed."
      : "Google authorization failed.";
    res.status(400).json({ message });
  }
});

export default router;