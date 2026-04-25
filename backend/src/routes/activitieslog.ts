import express from "express";

<<<<<<< HEAD
import { protect, authorize } from "../middleware/auth";
import { getAllActivities } from "../controllers/activitieslog";

const LogsRouter = express.Router();

LogsRouter.get("/", protect, authorize(["admin", "teacher"]), getAllActivities);
=======
import { protect, authorize } from "../middleware/auth.ts";
//import { getAllActivities } from "../controllers/activitieslog.ts";

const LogsRouter = express.Router();

//LogsRouter.get("/", protect, authorize(["admin", "teacher"]), getAllActivities);
>>>>>>> a77495f626dbe90aaff470650f7e47812e2b1d22

export default LogsRouter;