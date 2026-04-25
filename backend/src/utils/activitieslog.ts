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
<<<<<<< HEAD
    console.log("logActivity called with userId:", userId, "action:", action);
=======
>>>>>>> a77495f626dbe90aaff470650f7e47812e2b1d22
  try {
    await ActivitiesLog.create({
      user: userId,
      action,
      details,
    });
<<<<<<< HEAD
    console.log("Activity logged successfully:");
=======
>>>>>>> a77495f626dbe90aaff470650f7e47812e2b1d22
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};