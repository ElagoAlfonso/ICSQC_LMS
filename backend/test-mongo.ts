import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

console.log("MONGO_URL exists:", !!process.env.MONGO_URL);

try {
  await mongoose.connect(process.env.MONGO_URL!, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log("MongoDB connection SUCCESS");
  console.log("Connected host:", mongoose.connection.host);

  await mongoose.disconnect();
} catch (error) {
  console.error("MongoDB connection FAILED:");
  console.error(error);
}