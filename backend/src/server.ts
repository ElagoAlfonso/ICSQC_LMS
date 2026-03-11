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
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

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