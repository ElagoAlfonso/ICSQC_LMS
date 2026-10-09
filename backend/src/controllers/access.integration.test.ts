import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import cookieParser from "cookie-parser";
import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import combinedRouter from "../routes/combined.ts";
import classworkRouter from "../routes/classwork.ts";
import Class from "../models/class.ts";
import Classwork from "../models/classwork.ts";
import ClassworkSubmission from "../models/classworkSubmission.ts";
import Exam from "../models/exam.ts";
import ExamAttempt from "../models/examAttempt.ts";
import Submission from "../models/submission.ts";
import User from "../models/user.ts";

const JWT_SECRET = "integration-test-secret";
let mongo: MongoMemoryServer;
let server: Server;
let baseUrl: string;
let uploadDirectory: string;
let previousJwtSecret: string | undefined;

const createUser = (role: "admin" | "teacher" | "student") => User.create({
  name: `${role} user`,
  email: `${role}-${new mongoose.Types.ObjectId()}@test.local`,
  password: "test-password",
  role,
});

const cookieFor = (userId: string) => `jwt=${jwt.sign({ userId }, JWT_SECRET, { algorithm: "HS512" })}`;

const request = (path: string, cookie?: string, body?: unknown) => fetch(`${baseUrl}${path}`, {
  method: body ? "PUT" : "GET",
  headers: {
    ...(cookie ? { Cookie: cookie } : {}),
    ...(body ? { "Content-Type": "application/json" } : {}),
  },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

beforeAll(async () => {
  previousJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = JWT_SECRET;
  uploadDirectory = await mkdtemp(join(process.env.MONGOMS_DOWNLOAD_DIR || tmpdir(), "icsqc-lms-access-test-"));
  const mongoDataPath = join(uploadDirectory, "mongo-data");
  await mkdir(mongoDataPath, { recursive: true });
  mongo = await MongoMemoryServer.create({
    binary: { version: "7.0.14" },
    instance: { dbPath: mongoDataPath },
  });
  await mongoose.connect(mongo.getUri());

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api", combinedRouter);
  app.use("/api/classwork", classworkRouter);
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");
  baseUrl = `http://127.0.0.1:${address.port}`;
}, 60_000);

afterAll(async () => {
  if (server?.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (mongoose.connection.readyState) await mongoose.disconnect();
  if (mongo) await mongo.stop();
  if (uploadDirectory) await rm(uploadDirectory, { recursive: true, force: true });
  if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousJwtSecret;
});

describe("authenticated access endpoints", () => {
  it("updates a published exam, persists after reread, and preserves submissions, attempts, and grades", async () => {
    const admin = await createUser("admin");
    const student = await createUser("student");
    const exam = await Exam.create({
      title: "Original published exam",
      subject: new mongoose.Types.ObjectId(),
      class: new mongoose.Types.ObjectId(),
      academicYear: new mongoose.Types.ObjectId(),
      createdBy: admin._id,
      questions: [{ question: "Q1", type: "short_answer", correctAnswer: "A", points: 2 }],
      duration: 30,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
      examType: "quiz",
      status: "published",
    });
    const submission = await Submission.create({
      exam: exam._id,
      student: student._id,
      answers: [{ questionIndex: 0, answer: "A", isCorrect: true, pointsEarned: 2 }],
      score: 2,
      totalPoints: 2,
      percentage: 100,
      isPassed: true,
      status: "graded",
    });
    const attempt = await ExamAttempt.create({
      exam: exam._id,
      student: student._id,
      startedAt: new Date(Date.now() - 60_000),
      deadline: new Date(Date.now() + 60_000),
      questionOrder: [0],
      status: "submitted",
    });

    const updateResponse = await request(`/api/exams/${exam._id}`, cookieFor(admin._id.toString()), { title: "Updated published exam" });
    expect(updateResponse.status).toBe(200);
    const refreshedResponse = await request(`/api/exams/${exam._id}`, cookieFor(admin._id.toString()));
    expect(refreshedResponse.status).toBe(200);
    expect((await refreshedResponse.json() as { title: string }).title).toBe("Updated published exam");

    const [savedSubmission, savedAttempt] = await Promise.all([
      Submission.findById(submission._id).lean(),
      ExamAttempt.findById(attempt._id).lean(),
    ]);
    expect(savedSubmission).toMatchObject({ score: 2, totalPoints: 2, percentage: 100, isPassed: true, status: "graded" });
    expect(savedSubmission?.answers).toHaveLength(1);
    expect(savedAttempt).toMatchObject({ status: "submitted", questionOrder: [0] });
  });

  it("rejects teacher exam edits and serves submission files only to the owner or assigned teachers", async () => {
    const admin = await createUser("admin");
    const teacher = await createUser("teacher");
    const outsider = await createUser("teacher");
    const student = await createUser("student");
    const exam = await Exam.create({
      title: "Published exam",
      subject: new mongoose.Types.ObjectId(),
      class: new mongoose.Types.ObjectId(),
      academicYear: new mongoose.Types.ObjectId(),
      createdBy: admin._id,
      questions: [{ question: "Q1", type: "short_answer", correctAnswer: "A", points: 1 }],
      duration: 30,
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
      examType: "quiz",
      status: "published",
    });
    const deniedEdit = await request(`/api/exams/${exam._id}`, cookieFor(teacher._id.toString()), { title: "Unauthorized edit" });
    expect(deniedEdit.status).toBe(403);
    expect((await Exam.findById(exam._id).lean())?.title).toBe("Published exam");
    const deniedStudentEdit = await request(`/api/exams/${exam._id}`, cookieFor(student._id.toString()), { title: "Unauthorized edit" });
    expect(deniedStudentEdit.status).toBe(403);

    const classId = new mongoose.Types.ObjectId();
    const subjectId = new mongoose.Types.ObjectId();
    const academicYearId = new mongoose.Types.ObjectId();
    const classDoc = await Class.create({
      _id: classId,
      name: "Test class",
      section: "A",
      gradeLevel: "Grade 9",
      academicYear: academicYearId,
      adviser: teacher._id,
      subjects: [subjectId],
    });
    const filePath = join(uploadDirectory, "student-work.txt");
    const fileContents = "private student submission";
    await writeFile(filePath, fileContents);
    const classwork = await Classwork.create({
      title: "Uploaded work",
      description: "Student file",
      type: "assignment",
      class: classDoc._id,
      subject: subjectId,
      createdBy: admin._id,
      academicYear: academicYearId,
    });
    const submission = await ClassworkSubmission.create({
      classwork: classwork._id,
      student: student._id,
      class: classDoc._id,
      subject: subjectId,
      totalPoints: 10,
      attachments: [{
        originalName: "student-work.txt",
        storageName: "student-work.txt",
        storagePath: filePath,
        extension: "txt",
        mimeType: "text/plain",
        size: Buffer.byteLength(fileContents),
      }],
    });
    const attachmentId = submission.attachments[0]._id.toString();
    const attachmentPath = `/api/classwork/submissions/${submission._id}/attachments/${attachmentId}`;
    const inlineResponse = await request(attachmentPath, cookieFor(teacher._id.toString()));
    expect(inlineResponse.status).toBe(200);
    expect(await inlineResponse.text()).toBe(fileContents);
    expect(inlineResponse.headers.get("content-disposition")).toContain("inline");

    const downloadResponse = await request(`${attachmentPath}?download=1`, cookieFor(teacher._id.toString()));
    expect(downloadResponse.status).toBe(200);
    expect(await downloadResponse.text()).toBe(fileContents);
    expect(downloadResponse.headers.get("content-disposition")).toContain("attachment");

    const deniedFile = await request(attachmentPath, cookieFor(outsider._id.toString()));
    expect(deniedFile.status).toBe(403);
    const unauthenticatedFile = await request(attachmentPath);
    expect(unauthenticatedFile.status).toBe(401);
  });
});