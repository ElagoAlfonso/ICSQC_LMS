import mongoose, { Schema, Document } from "mongoose";

export interface IAcademicYear extends Document {
    name: string;
    startDate: Date;
    endDate: Date;
    isCurrent: boolean;
}

const academicYearSchema = new Schema(
    {
        name: { type: String, required: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        isCurrent: { type: Boolean, default: false },
    },
    {
        timestamps: true,
    }
);  

export default mongoose.model<IAcademicYear>(
    "AcademicYear",
    academicYearSchema
);
