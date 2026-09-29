import { Router } from "express";
import { chat, getAccess } from "../controllers/ai";
import { protect } from "../middleware/auth";

const router = Router();

router.get("/access", protect, getAccess);
router.post("/chat", protect, chat);

export default router;