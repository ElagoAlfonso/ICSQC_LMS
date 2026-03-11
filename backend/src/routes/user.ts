import express from "express";

const userRoutes = express.Router();

import { register, login } from "../controllers/user";
import { protect, authorize} from "../middleware/auth";

// make sure to protect to get access to the user token
userRoutes.post("/register", protect, authorize(["admin", "teacher"]),register);
userRoutes.post("/login", login);

export default userRoutes;      

// next part is to protect the routes, also add a rolebased access