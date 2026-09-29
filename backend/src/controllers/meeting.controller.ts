import { type Response } from "express";
import { type AuthRequest } from "../middleware/auth";
import Class from "../models/class";
import Meeting, { type MeetingStatus } from "../models/meeting.model";
import Subject from "../models/subject";
import User from "../models/user";
import { createNotifications } from "../utils/notifications";
import { createGoogleMeetEvent, deleteGoogleMeetEvent, updateGoogleMeetEvent } from "../services/googleMeet.service";

const meetingStatus = (start: Date, end: Date, stored: MeetingStatus): MeetingStatus => {
  if (stored === "Cancelled") return stored;
  const now = Date.now();
  if (now < start.getTime()) return "Scheduled";
  if (now <= end.getTime()) return "Live";
  return "Finished";
};

const parseSchedule = (body: any) => {
  const startDateTime = body.startDateTime || (body.scheduledDate && body.startTime ? `${body.scheduledDate}T${body.startTime}` : "");
  const endDateTime = body.endDateTime || (body.scheduledDate && body.endTime ? `${body.scheduledDate}T${body.endTime}` : "");
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  if (!startDateTime || !endDateTime || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("A valid date, start time, and end time are required.");
  if (start <= new Date()) throw new Error("Meeting schedules must be in the future.");
  if (end <= start) throw new Error("End time must be after start time.");
  return { start, end };
};

const validateResources = async (classId: string, subjectId: string, teacherId: string, isAdmin: boolean) => {
  const [classDoc, subjectDoc] = await Promise.all([Class.findById(classId), Subject.findById(subjectId)]);
  if (!classDoc || !subjectDoc) throw new Error("Class or subject not found.");
  if (!isAdmin && classDoc.adviser?.toString() !== teacherId && subjectDoc.teacher?.toString() !== teacherId) {
    throw new Error("You are not assigned to this class or subject.");
  }
  return { classDoc, subjectDoc };
};

const overlapExists = async (classId: string, start: Date, end: Date, excludeId?: string) => {
  const filter: any = { classId, status: { $ne: "Cancelled" }, startDateTime: { $lt: end }, endDateTime: { $gt: start } };
  if (excludeId) filter._id = { $ne: excludeId };
  return Meeting.exists(filter);
};

const meetingResponse = (meeting: any) => {
  const result = meeting.toObject ? meeting.toObject() : meeting;
  result.status = meetingStatus(new Date(result.startDateTime), new Date(result.endDateTime), result.status);
  return result;
};

export const createMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classId = req.params.classId || req.body.classId;
    const { subjectId } = req.body;
    const meetingTitle = req.body.meetingTitle || "Google Meet";
    if (!classId || !subjectId) { res.status(400).json({ message: "Subject is required." }); return; }
    const { start, end } = parseSchedule(req.body);
    const { classDoc, subjectDoc } = await validateResources(classId, subjectId, req.user!._id.toString(), false);
    if (await overlapExists(classId, start, end)) { res.status(409).json({ message: "This class already has a meeting during that time." }); return; }

    // Google creates the Calendar event and conference before the Mongo record is published.
    const googleEvent = await createGoogleMeetEvent(req.user!._id.toString(), { title: meetingTitle, startDateTime: start, endDateTime: end });
    const meeting = await Meeting.create({ teacherId: req.user!._id, classId, subjectId, ...googleEvent, meetingTitle, startDateTime: start, endDateTime: end });
    const students = await User.find({ role: "student", isActive: true, $or: [{ studentClass: classId }, { _id: { $in: classDoc.students } }] }).select("_id");
    await createNotifications(students.map((student) => student._id), {
      title: "New Google Meet session",
      message: `${subjectDoc.name}\n${start.toLocaleDateString()}\n${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      type: "meeting", relatedResource: meeting._id, relatedClass: classId,
    });
    res.status(201).json({ meeting: meetingResponse(meeting), message: "Google Meet created successfully." });
  } catch (error: any) { res.status(error?.message?.includes("assigned") ? 403 : 400).json({ message: error?.message || "Unable to create meeting." }); }
};

export const updateMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meeting = await Meeting.findById(req.params.meetingId || req.params.id);
    if (req.params.classId && meeting?.classId.toString() !== req.params.classId) { res.status(404).json({ message: "Meeting not found in this class." }); return; }
    if (!meeting) { res.status(404).json({ message: "Meeting not found." }); return; }
    const isAdmin = req.user!.role === "admin";
    if (!isAdmin && meeting.teacherId.toString() !== req.user!._id.toString()) { res.status(403).json({ message: "You can only update your own meetings." }); return; }
    const classId = req.body.classId || meeting.classId.toString();
    const subjectId = req.body.subjectId || meeting.subjectId?.toString();
    if (!subjectId) { res.status(400).json({ message: "Subject is required for scheduled meetings." }); return; }
    await validateResources(classId, subjectId, meeting.teacherId.toString(), isAdmin);
    const { start, end } = parseSchedule({ ...req.body, startDateTime: req.body.startDateTime || meeting.startDateTime, endDateTime: req.body.endDateTime || meeting.endDateTime });
    if (await overlapExists(classId, start, end, meeting._id.toString())) { res.status(409).json({ message: "This class already has a meeting during that time." }); return; }
    await updateGoogleMeetEvent(meeting.teacherId.toString(), meeting.eventId, { title: req.body.meetingTitle || meeting.meetingTitle, description: req.body.description ?? meeting.description, startDateTime: start, endDateTime: end });
    Object.assign(meeting, { classId, subjectId, meetingTitle: req.body.meetingTitle || meeting.meetingTitle, description: req.body.description ?? meeting.description, startDateTime: start, endDateTime: end });
    await meeting.save();
    res.json({ meeting: meetingResponse(meeting), message: "Meeting updated successfully." });
  } catch (error: any) { res.status(error?.message?.includes("assigned") ? 403 : 400).json({ message: error?.message || "Unable to update meeting." }); }
};

export const deleteMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) { res.status(404).json({ message: "Meeting not found." }); return; }
    if (req.user!.role !== "admin" && meeting.teacherId.toString() !== req.user!._id.toString()) { res.status(403).json({ message: "You can only delete your own meetings." }); return; }
    await deleteGoogleMeetEvent(meeting.teacherId.toString(), meeting.eventId);
    await meeting.deleteOne();
    res.json({ message: "Meeting deleted successfully." });
  } catch (error: any) { res.status(400).json({ message: error?.message || "Unable to delete meeting." }); }
};

export const getTeacherMeetings = async (req: AuthRequest, res: Response): Promise<void> => {
  const meetings = await Meeting.find({ teacherId: req.user!._id }).populate("subjectId", "name code").populate("classId", "name section").sort({ startDateTime: 1 });
  res.json({ meetings: meetings.map(meetingResponse) });
};

export const getStudentMeetings = async (req: AuthRequest, res: Response): Promise<void> => {
  const meetings = await Meeting.find({ classId: req.user!.studentClass, status: { $ne: "Cancelled" } }).populate("subjectId", "name code").populate("teacherId", "name").populate("classId", "name section").sort({ startDateTime: 1 });
  res.json({ meetings: meetings.map(meetingResponse) });
};

export const getMeetingById = async (req: AuthRequest, res: Response): Promise<void> => {
  const meeting = await Meeting.findById(req.params.id).populate("subjectId", "name code").populate("teacherId", "name").populate("classId", "name section");
  if (!meeting) { res.status(404).json({ message: "Meeting not found." }); return; }
  if (req.user!.role === "student" && meeting.classId._id.toString() !== req.user!.studentClass?.toString()) { res.status(403).json({ message: "You are not enrolled in this class." }); return; }
  res.json({ meeting: meetingResponse(meeting) });
};

export const getAdminMeetings = async (req: AuthRequest, res: Response): Promise<void> => {
  const filter: any = {};
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.subjectId) filter.subjectId = req.query.subjectId;
  if (req.query.teacherId) filter.teacherId = req.query.teacherId;
  if (req.query.date) { const date = new Date(`${req.query.date}T00:00:00`); const next = new Date(date); next.setDate(next.getDate() + 1); filter.startDateTime = { $gte: date, $lt: next }; }
  const meetings = await Meeting.find(filter).populate("subjectId", "name code").populate("teacherId", "name").populate("classId", "name section").sort({ startDateTime: 1 });
  res.json({ meetings: meetings.map(meetingResponse), total: meetings.length });
};

export const cancelMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const meeting = await Meeting.findOne({ _id: req.params.meetingId || req.params.id, ...(req.params.classId ? { classId: req.params.classId } : {}) });
    if (!meeting) { res.status(404).json({ message: "Meeting not found." }); return; }
    if (req.user!.role !== "admin" && meeting.teacherId.toString() !== req.user!._id.toString()) { res.status(403).json({ message: "You can only cancel your own meetings." }); return; }
    await deleteGoogleMeetEvent(meeting.teacherId.toString(), meeting.eventId);
    meeting.status = "Cancelled";
    await meeting.save();
    res.json({ meeting: meetingResponse(meeting), message: "Meeting cancelled successfully." });
  } catch (error: any) { res.status(400).json({ message: error?.message || "Unable to cancel meeting." }); }
};

const assertClassAccess = async (req: AuthRequest, classId: string, canManage: boolean) => {
  const classDoc = await Class.findById(classId);
  if (!classDoc) throw new Error("Class not found.");
  const userId = req.user!._id.toString();
  const isAdviser = classDoc.adviser?.toString() === userId;
  const isStudent = classDoc.students.some((student) => student.toString() === userId);
  if (canManage && req.user!.role !== "admin" && !isAdviser) throw new Error("You are not authorized to manage this class.");
  if (!canManage && req.user!.role === "student" && !isStudent) throw new Error("You are not enrolled in this class.");
  return classDoc;
};

export const getClassMeetings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classId = String(req.params.classId);
    await assertClassAccess(req, classId, false);
    const meetings = await Meeting.find({ classId }).populate("subjectId", "name code").populate("teacherId", "name").sort({ startDateTime: 1 });
    res.json({ meetings: meetings.map(meetingResponse) });
  } catch (error: any) { res.status(error?.message?.includes("not enrolled") ? 403 : 400).json({ message: error?.message || "Unable to load meetings." }); }
};

const classMeetError = (error: any) => {
  const message = error?.message || "Unable to access Google Meet.";
  if (message.includes("not configured")) return "Google Meet is not configured by the administrator.";
  if (message.includes("not connected")) return "Connect your Google Calendar before creating a Meet.";
  if (message.includes("did not return")) return "Google could not create the Meet link. Please try again.";
  return message;
};

export const getClassMeet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classId = String(req.params.classId);
    await assertClassAccess(req, classId, false);
    const meeting = await Meeting.findOne({ classId, status: { $ne: "Cancelled" } })
      .populate("subjectId", "name code")
      .sort({ createdAt: -1 });
    res.json({ meeting: meeting ? meetingResponse(meeting) : null });
  } catch (error: any) {
    res.status(error?.message?.includes("not enrolled") ? 403 : 400).json({ message: classMeetError(error) });
  }
};

export const createClassMeet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classId = String(req.params.classId);
    const classDoc = await assertClassAccess(req, classId, true);
    const existing = await Meeting.findOne({ classId, status: { $nin: ["Cancelled", "Finished"] }, endDateTime: { $gt: new Date() } });
    if (existing) {
      res.status(409).json({ message: "This class already has an active Google Meet." });
      return;
    }

    const startDateTime = new Date();
    const endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000);
    const googleEvent = await createGoogleMeetEvent(req.user!._id.toString(), {
      title: `${classDoc.name} - ${classDoc.section} Google Meet`,
      startDateTime,
      endDateTime,
    });
    const meeting = await Meeting.create({
      teacherId: req.user!._id,
      classId,
      ...(classDoc.subjects[0] ? { subjectId: classDoc.subjects[0] } : {}),
      ...googleEvent,
      meetingTitle: `${classDoc.name} - ${classDoc.section} Google Meet`,
      startDateTime,
      endDateTime,
    });
    res.status(201).json({ meeting: meetingResponse(meeting), message: "Google Meet created successfully." });
  } catch (error: any) {
    const status = error?.message?.includes("authorized") || error?.message?.includes("enrolled") ? 403 : 400;
    res.status(status).json({ message: classMeetError(error) });
  }
};

export const endClassMeet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const classId = String(req.params.classId);
    await assertClassAccess(req, classId, true);
    const meeting = await Meeting.findOne({ classId, status: { $nin: ["Cancelled", "Finished"] }, endDateTime: { $gt: new Date() } }).sort({ createdAt: -1 });
    if (!meeting) {
      res.status(404).json({ message: "No active Google Meet exists for this class." });
      return;
    }
    await deleteGoogleMeetEvent(meeting.teacherId.toString(), meeting.eventId);
    meeting.status = "Finished";
    meeting.endDateTime = new Date();
    await meeting.save();
    res.json({ meeting: meetingResponse(meeting), message: "Google Meet ended." });
  } catch (error: any) {
    const status = error?.message?.includes("authorized") ? 403 : 400;
    res.status(status).json({ message: classMeetError(error) });
  }
};