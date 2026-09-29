import mongoose, { Schema, Document } from "mongoose";

export interface IRubricCriterion {
  id: string;
  title: string;
  description: string;
  maxPoints: number;
}

export interface IRubric extends Document {
  name: string;
  criteria: IRubricCriterion[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const criterionSchema = new Schema<IRubricCriterion>({
  id: { type: String, required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 500, default: "" },
  maxPoints: { type: Number, required: true, min: 0 },
}, { _id: false });

const rubricSchema = new Schema<IRubric>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    criteria: { type: [criterionSchema], required: true, validate: (items: IRubricCriterion[]) => items.length > 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.model<IRubric>("Rubric", rubricSchema);