import mongoose from "mongoose";

const MONGOOSE_CONNECTION_OPTIONS = {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  tls: true,
  appName: "ICSQC-LMS",
} as const;

let connectionPromise: Promise<typeof mongoose> | null = null;

export const getMongoUri = () => {
  const configured = (process.env.MONGODB_URI ?? process.env.MONGO_URL)?.trim();

  if (!configured) {
    throw new Error(
      "❌ MONGODB_URI is not configured. Please add your MongoDB Atlas connection string to the backend .env file."
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    /^mongodb:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::|\/)/i.test(configured)
  ) {
    throw new Error("Production must use a hosted MongoDB deployment, not a local database.");
  }

  return configured;
};

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const mongoUri = getMongoUri();

  try {
    if (!connectionPromise) {
      connectionPromise = mongoose
        .connect(mongoUri, MONGOOSE_CONNECTION_OPTIONS)
        .then((connection) => {
          console.log("Connected to MongoDB.");
          return connection;
        })
        .catch((error) => {
          connectionPromise = null;
          throw error;
        });
    }
    return await connectionPromise;
  } catch {
    console.error("MongoDB connection failed.");
    throw new Error("Database connection failed.");
  }
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
  connectionPromise = null;
  console.log("✅ MongoDB disconnected");
};