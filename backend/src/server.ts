<<<<<<< HEAD
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

=======
// set up of a simple server
import cookieParser from "cookie-parser";
import express, { 
  type Application, 
  type Request, 
  type Response 
} from "express";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import cors from "cors";  

import { connectDB } from "./config/db";
import userRoutes from "./routes/user";

// Load environment variables from .env file
>>>>>>> a77495f626dbe90aaff470650f7e47812e2b1d22
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

<<<<<<< HEAD
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
=======
//next part is adding a security middleware/header + make sure to listen on *root file* for changes

app.use(helmet()) // security middleware to set various HTTP headers for security
app.use(express.json()) // middleware to parse incoming JSON requests
app.use(express.urlencoded({ extended: true })) // middleware to parse URL-encoded data
app.use(cookieParser()) // middleware to parse cookies

//log http requests to the console
// NODE_ENV missing in .env file
if(process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

//cross-origin resource sharing (CORS) middleware to allow requests from different origins
//credentials: true, // allow cookies to be sent with requests
app.use(
    cors({
        origin: process.env.CLIENT_URL, 
        credentials: true,
    })
)

//health check route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ status: "OK", message: "Server is healthy" });       
});

// import user routes
app.use("/api/users", userRoutes);

//global error handling middleware
app.use(
    (err: Error, req: Request, res: Response, next: Function) => {
  console.error(err.stack);
  res.status(500).json({ status: "ERROR", message: err });
});

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log("Server is running on port 5000");
    });
});

//  you can use any of these scripts in your package.json to run the server with  nodemon or bun
//        "dev" : "nodemon --exec bun run index.ts",
//          "start": "bun --watch index.ts"
// if it's the first time you will redirect to create a new project
>>>>>>> a77495f626dbe90aaff470650f7e47812e2b1d22
