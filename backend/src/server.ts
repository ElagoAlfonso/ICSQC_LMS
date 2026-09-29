import "dotenv/config";
import cookieParser from "cookie-parser";
import express, { type Application, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import cors from "cors";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer, type Server as HttpServer } from "node:http";

import { connectDB, disconnectDB } from "./config/db";
import userRoutes from "./routes/user";
import authRoutes from "./routes/authRoutes";
import LogsRouter from "./routes/activitieslog";
import academicYearRouter from "./routes/academicYear";
import classworkRouter from "./routes/classwork";
import rubricRouter from "./routes/rubric";
import messagingRouter from "./routes/messaging";
import combinedRouter from "./routes/combined";
import meetingRouter from "./routes/meeting.routes";
import googleRouter from "./routes/google.routes";
import { closeRealtime, initializeRealtime } from "./realtime";
import aiRouter from "./routes/ai";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const DEFAULT_PORT = 5000;
const PORT = Number(process.env.PORT ?? DEFAULT_PORT);
const SERVER_PORT = Number.isFinite(PORT) && PORT > 0 ? PORT : DEFAULT_PORT;

const app: Application = express();
let httpServer: HttpServer | null = null;
let isShuttingDown = false;

const configureApp = (): Application => {
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  if (process.env.NODE_ENV === "development") {
    app.use(morgan("dev"));
  }

  const allowedOrigins = new Set(
    (process.env.CLIENT_URL || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
  if (process.env.NODE_ENV === "development") {
    allowedOrigins.add("http://localhost:5173");
  }

  app.use(cors({
    origin: (origin, callback) => callback(null, origin && allowedOrigins.has(origin) ? origin : false),
    credentials: true,
  }));
  app.use((req, res, next) => {
    const origin = req.get("origin");
    const isMutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (origin && isMutation && !allowedOrigins.has(origin)) {
      res.status(403).json({ status: "ERROR", message: "Request origin is not allowed" });
      return;
    }
    next();
  });

  app.get("/", (req: Request, res: Response) => {
    res.status(200).json({ status: "OK", message: "ICSQC-LMS API is running" });
  });

  app.use(async (_req, _res, next) => {
    try {
      await connectDB();
      next();
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/users", userRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/activitieslog", LogsRouter);
  app.use("/api/academicYear", academicYearRouter);
  app.use("/api/classwork", classworkRouter);
  app.use("/api/rubrics", rubricRouter);
  app.use("/api/messages", messagingRouter);
  app.use("/api/ai", aiRouter);

  app.use("/api", combinedRouter);
  app.use("/api", meetingRouter);
  app.use("/api", googleRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: Function) => {
    const errorName = err instanceof Error ? err.name : "UnknownError";
    console.error(`Request failed (${errorName}).`);
    const message = process.env.NODE_ENV === "development" && err instanceof Error
      ? err.message
      : "Internal server error";
    res.status(500).json({ status: "ERROR", message });
  });

  return app;
};

configureApp();

export const startServer = async (): Promise<HttpServer> => {
  if (httpServer) {
    return httpServer;
  }

  try {
    await connectDB();
    httpServer = createServer(app);
    initializeRealtime(httpServer);

    await new Promise<void>((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
          console.error(
            `❌ Port ${SERVER_PORT} is already in use. Stop the previous Bun/Node process or free the port before restarting.`
          );
        }
        reject(error);
      };

      httpServer!.once("error", onError);
      httpServer!.listen(SERVER_PORT, () => {
        httpServer!.off("error", onError);
        console.log(`✅ ICSQC-LMS Server running on port ${SERVER_PORT}`);
        console.log(`📚 API available at http://localhost:${SERVER_PORT}/api`);
        resolve();
      });
    });

    return httpServer;
  } catch (error) {
    console.error("❌ Failed to start server.", error);
    await stopServer();
    throw error;
  }
};

export const stopServer = async (): Promise<void> => {
  if (!httpServer) {
    return;
  }

  try {
    await closeRealtime();
  } catch {
    // ignore socket cleanup errors for a server that never fully started
  }

  if (!httpServer.listening) {
    httpServer = null;
    return;
  }

  await new Promise<void>((resolve, reject) => {
    httpServer!.close((error) => {
      if (error) {
        if ((error as NodeJS.ErrnoException).code === "ERR_SERVER_NOT_RUNNING") {
          resolve();
          httpServer = null;
          return;
        }
        reject(error);
        return;
      }
      httpServer = null;
      resolve();
    });
  });
};

const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`🛑 Received ${signal}. Shutting down the backend cleanly...`);

  try {
    await stopServer();
    await disconnectDB();
  } finally {
    process.exit(0);
  }
};

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectRun) {
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGUSR2", () => void shutdown("SIGUSR2"));
  void startServer().catch((error) => {
    console.error("❌ Failed to start server. Check the configured port and database connection.");
    process.exit(1);
  });
}

export default app;
