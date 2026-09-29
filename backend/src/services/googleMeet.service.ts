import { google, calendar_v3 } from "googleapis";
import { v4 as uuidv4 } from "uuid";
import GoogleToken from "../models/googleToken.model";

const scopes = ["https://www.googleapis.com/auth/calendar.events"];

export const createOAuthClient = () => new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export const getGoogleAuthUrl = (state: string) => createOAuthClient().generateAuthUrl({
  access_type: "offline", prompt: "consent", scope: scopes, state,
});

export const saveGoogleTokens = async (teacherId: string, client: { credentials: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
} }) => {
  const credentials = client.credentials;
  if (!credentials.access_token || !credentials.refresh_token) {
    throw new Error("Google did not return the required tokens. Reconnect Google Calendar.");
  }
  return GoogleToken.findOneAndUpdate(
    { teacherId },
    {
      teacherId,
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token,
      expiryDate: new Date(credentials.expiry_date || Date.now()),
    },
    { upsert: true, new: true }
  );
};

export const getTeacherCalendar = async (teacherId: string) => {
  const token = await GoogleToken.findOne({ teacherId });
  if (!token) throw new Error("Google Calendar is not connected. Connect it before creating a meeting.");
  const client = createOAuthClient();
  client.setCredentials({ access_token: token.accessToken, refresh_token: token.refreshToken, expiry_date: token.expiryDate.getTime() });
  client.on("tokens", async (credentials) => {
    await GoogleToken.findOneAndUpdate({ teacherId }, {
      ...(credentials.access_token ? { accessToken: credentials.access_token } : {}),
      ...(credentials.refresh_token ? { refreshToken: credentials.refresh_token } : {}),
      ...(credentials.expiry_date ? { expiryDate: new Date(credentials.expiry_date) } : {}),
    });
  });
  return google.calendar({ version: "v3", auth: client });
};

export const createGoogleMeetEvent = async (teacherId: string, input: {
  title: string; description?: string; startDateTime: Date; endDateTime: Date;
}) => {
  const calendar = await getTeacherCalendar(teacherId);
  const event: calendar_v3.Schema$Event = {
    summary: input.title,
    description: input.description || "",
    start: { dateTime: input.startDateTime.toISOString(), timeZone: process.env.GOOGLE_TIME_ZONE || "Asia/Manila" },
    end: { dateTime: input.endDateTime.toISOString(), timeZone: process.env.GOOGLE_TIME_ZONE || "Asia/Manila" },
    conferenceData: { createRequest: { requestId: uuidv4(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
  };
  const response = await calendar.events.insert({ calendarId: "primary", requestBody: event, conferenceDataVersion: 1 });
  const meetLink = response.data.hangoutLink || response.data.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri;
  if (!response.data.id || !meetLink) throw new Error("Google Calendar did not return a Meet link.");
  return { eventId: response.data.id, meetLink };
};

export const updateGoogleMeetEvent = async (teacherId: string, eventId: string, input: {
  title: string; description?: string; startDateTime: Date; endDateTime: Date;
}) => {
  const calendar = await getTeacherCalendar(teacherId);
  await calendar.events.patch({ calendarId: "primary", eventId, requestBody: {
    summary: input.title,
    description: input.description || "",
    start: { dateTime: input.startDateTime.toISOString(), timeZone: process.env.GOOGLE_TIME_ZONE || "Asia/Manila" },
    end: { dateTime: input.endDateTime.toISOString(), timeZone: process.env.GOOGLE_TIME_ZONE || "Asia/Manila" },
  } });
};

export const deleteGoogleMeetEvent = async (teacherId: string, eventId: string) => {
  const calendar = await getTeacherCalendar(teacherId);
  try { await calendar.events.delete({ calendarId: "primary", eventId }); } catch (error: any) {
    if (error?.code !== 404) throw error;
  }
};