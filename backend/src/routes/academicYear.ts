import express  from "express";
import { createAcademicYear, getAllAcademicYears } from "../controllers/academicYear";
import { authorize , protect} from "../middleware/auth";

const academicYearRouter = express.Router();

academicYearRouter 
.route("/")
.get(protect, authorize (["admin", "teacher"]), getAllAcademicYears)
.post(protect, authorize (["admin", "teacher"]), createAcademicYear)

export default academicYearRouter;