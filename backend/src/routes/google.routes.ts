import express from "express";
import { protect, authorize, type AuthRequest } from "../middleware/auth.ts";
import { createGoogleOAuthState, requireGoogleConfiguration, verifyGoogleOAuthState } from "../middleware/googleAuth.ts";
import { createGoogleMeetEvent, createOAuthClient, getGoogleAuthUrl, saveGoogleTokens } from "../services/googleMeet.service.ts";
import GoogleToken from "../models/googleToken.model.ts";
import Class from "../models/class.ts";
import Meeting from "../models/meeting.model.ts";

const router = express.Router();

const getClientUrl = () => process.env.CLIENT_URL?.split(",").map((origin) => origin.trim()).find(Boolean);

const redirectGoogleError = (res: express.Response, message: string, role = "teacher", classId?: string) => {
  const clientUrl = getClientUrl();
  if (!clientUrl) {
    res.status(503).send("Google authorization failed. The frontend URL is not configured.");
    return;
  }
  const resultUrl = new URL("/meet-result", clientUrl);
  resultUrl.searchParams.set("message", message);
  resultUrl.searchParams.set("role", role);
  if (classId) resultUrl.searchParams.set("classId", classId);
  res.redirect(resultUrl.toString());
};

const googleCallbackMessage = (error: any) => {
  const details = [
    error?.message,
    error?.response?.data?.error?.message,
    error?.response?.data?.error_description,
    error?.response?.data?.error?.status,
    ...(error?.response?.data?.error?.errors || []).map((item: any) => item?.reason),
  ].filter(Boolean).join(" ").toLowerCase();
  if (details.includes("calendar api") && (details.includes("disabled") || details.includes("not been used")) || details.includes("accessnotconfigured")) {
    return "Google Calendar API is disabled. Ask the administrator to enable it in Google Cloud Console.";
  }
  if (details.includes("insufficient") || details.includes("scope") || details.includes("insufficientpermissions")) {
    return "Google Calendar access is missing the required permission. Reconnect Google Calendar and approve calendar.events access.";
  }
  if (details.includes("invalid_grant") || details.includes("expired")) return "Google authorization expired. Please start again.";
  if (details.includes("not configured")) return "Google Calendar is not configured. Contact your administrator.";
  if (details.includes("not authorized") || details.includes("not assigned")) return "You are not authorized to create a Meet for this class.";
  if (details.includes("class not found")) return "The selected class could not be found.";
  return "Google Meet could not be created. Please try again or reconnect Google Calendar.";
};

router.get("/google/status", protect, authorize(["teacher", "admin"]), requireGoogleConfiguration, async (req: AuthRequest, res) => {
  const connected = Boolean(await GoogleToken.exists({ teacherId: req.user!._id }));
  res.json({ connected });
});

router.get("/google/auth", protect, authorize(["teacher", "admin"]), requireGoogleConfiguration, (req: AuthRequest, res) => {
  const role = req.user!.role === "admin" ? "admin" : "teacher";
  const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
  res.redirect(getGoogleAuthUrl(createGoogleOAuthState(req.user!._id.toString(), role, classId)));
});

router.get("/google/callback", async (req, res) => {
  let oauthState: ReturnType<typeof verifyGoogleOAuthState> | undefined;
  try {
    oauthState = verifyGoogleOAuthState(typeof req.query.state === "string" ? req.query.state : "");
    const clientUrl = getClientUrl();
    if (!clientUrl) {
      res.status(503).send("Google authorization failed. The frontend URL is not configured.");
      return;
    }
    if (typeof req.query.error === "string") {
      redirectGoogleError(res, req.query.error === "access_denied" ? "Google authorization was cancelled." : "Google authorization failed. Please try again.", oauthState.role, oauthState.classId);
      return;
    }
    if (typeof req.query.code !== "string" || !req.query.code) {
      redirectGoogleError(res, "Google did not return an authorization code. Please try again.", oauthState.role, oauthState.classId);
      return;
    }
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      redirectGoogleError(res, "Google Calendar is not configured. Contact your administrator.", oauthState.role, oauthState.classId);
      return;
    }

    const client = createOAuthClient();
    const { tokens } = await client.getToken(req.query.code);
    client.setCredentials(tokens);
    await saveGoogleTokens(oauthState.teacherId, client);

    if (oauthState.classId) {
      const classDoc = await Class.findById(oauthState.classId);
      if (!classDoc) throw new Error("Class not found.");
      if (oauthState.role !== "admin" && classDoc.adviser?.toString() !== oauthState.teacherId) {
        throw new Error("You are not authorized to create a Meet for this class.");
      }
      const existingMeeting = await Meeting.findOne({
        classId: oauthState.classId,
        status: { $nin: ["Cancelled", "Finished"] },
        endDateTime: { $gt: new Date() },
      });
      if (existingMeeting) {
        res.redirect(existingMeeting.meetLink);
        return;
      }

      const startDateTime = new Date();
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
      const meetingTitle = `${classDoc.name} - ${classDoc.section} Google Meet`;
      const googleEvent = await createGoogleMeetEvent(oauthState.teacherId, {
        title: meetingTitle,
        startDateTime,
        endDateTime,
      });
      const meeting = await Meeting.create({
        teacherId: oauthState.teacherId,
        classId: oauthState.classId,
        ...(classDoc.subjects[0] ? { subjectId: classDoc.subjects[0] } : {}),
        ...googleEvent,
        meetingTitle,
        startDateTime,
        endDateTime,
      });
      res.redirect(meeting.meetLink);
      return;
    }

    res.redirect(new URL(`/${oauthState.role}/dashboard?google=connected`, clientUrl).toString());
  } catch (error: any) {
    redirectGoogleError(res, googleCallbackMessage(error), oauthState?.role, oauthState?.classId);
  }
});

export default router;