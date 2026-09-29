import { Router } from "express";
import { chat, getAccess } from "../controllers/ai.ts";
import { protect } from "../middleware/auth.ts";

const router = Router();

router.get("/access", protect, getAccess);
router.post("/chat", protect, chat);

export default router;