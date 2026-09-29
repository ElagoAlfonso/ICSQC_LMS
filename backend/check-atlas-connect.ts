import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const rawUri = process.env.MONGODB_URI;
if (!rawUri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

const redactedUri = rawUri.replace(/:([^@]+)@/, ":***@");
console.log("Attempting MongoDB Atlas connection with:");
console.log(redactedUri);

try {
  const conn = await mongoose.connect(rawUri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    tls: true,
    appName: "ICSQC-LMS-Connection-Test",
  });

  console.log("MongoDB connection SUCCESS");
  console.log("Connected host:", conn.connection.host);
  console.log("Database name:", conn.connection.name);
  await mongoose.disconnect();
  process.exit(0);
} catch (error) {
  console.error("MongoDB connection FAILED:");
  console.error(error);
  process.exit(1);
}
