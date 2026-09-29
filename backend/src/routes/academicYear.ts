import express  from "express";
import { createAcademicYear, getAllAcademicYears } from "../controllers/academicYear.ts";
import { authorize , protect} from "../middleware/auth.ts";

const academicYearRouter = express.Router();

academicYearRouter 
.route("/")
.get(protect, authorize (["admin", "teacher"]), getAllAcademicYears)
.post(protect, authorize (["admin", "teacher"]), createAcademicYear)

export default academicYearRouter;