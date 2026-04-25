import ActivitiesLog from "../models/activitieslog.ts";

export const logActivity = async ({
  userId,
  action,
  details,
}: {
  userId: string;
  action: string;
  details?: string;
}) => {
    console.log("logActivity called with userId:", userId, "action:", action);
  try {
    await ActivitiesLog.create({
      user: userId,
      action,
      details,
    });
    console.log("Activity logged successfully:");
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};