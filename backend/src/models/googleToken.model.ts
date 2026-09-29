import mongoose, { Document, Schema } from "mongoose";

export interface IGoogleToken extends Document {
  teacherId: mongoose.Types.ObjectId;
  accessToken: string;
  refreshToken: string;
  expiryDate: Date;
}

const googleTokenSchema = new Schema<IGoogleToken>(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiryDate: { type: Date, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IGoogleToken>("GoogleToken", googleTokenSchema);