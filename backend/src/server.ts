import cookieParser from "cookie-parser";
import express, { type Application, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import cors from "cors";

import { connectDB } from "./config/db";
import userRoutes from "./routes/user";
import LogsRouter from "./routes/activitieslog";
import academicYearRouter from "./routes/academicYear";
import combinedRouter from "./routes/combined";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Health check
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ status: "OK", message: "ICSQC-LMS API is running" });
});

// Existing routes (preserved)
app.use("/api/users", userRoutes);
app.use("/api/activitieslog", LogsRouter);
app.use("/api/academicYear", academicYearRouter);

// New combined routes
app.use("/api", combinedRouter);

// Global error handler
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error(err.stack);
  res.status(500).json({ status: "ERROR", message: err.message });
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ ICSQC-LMS Server running on port ${PORT}`);
    console.log(`📚 API available at http://localhost:${PORT}/api`);
  });
});
