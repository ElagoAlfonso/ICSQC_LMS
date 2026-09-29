import express from "express";
import { forgotPassword } from "../controllers/auth/forgotPassword";
import { resetPassword, verifyResetToken } from "../controllers/auth/resetPassword";

const router = express.Router();

router.post("/forgot-password", forgotPassword);
router.get("/reset-password/:token", verifyResetToken);
router.post("/reset-password/:token", resetPassword);

export default router;