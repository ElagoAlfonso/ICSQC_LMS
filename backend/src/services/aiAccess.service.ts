import type { AuthRequest } from "../middleware/auth";

export const AI_RESTRICTED_MESSAGE = "AI assistance isn't available while you're answering an active assessment. Please finish your assessment first.";

export const canUseAI = async (user: AuthRequest["user"]): Promise<{ allowed: boolean; message?: string }> => {
  if (!user) {
    return { allowed: false, message: "Not authorized" };
  }

  return { allowed: true };
};