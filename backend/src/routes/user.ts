import express from 'express';
import { forgotPassword } from '../controllers/auth/forgotPassword.ts';
import { resetPassword, verifyResetToken } from '../controllers/auth/resetPassword.ts';
import {
    register,
    login,
    updateUser,
    deleteUser,
    getUserProfile,
    updateProfilePhoto,
    removeProfilePhoto,
    logout,
    getUsers,
} from '../controllers/user.ts';
import { protect, authorize } from '../middleware/auth.ts';
import { parseProfilePhoto } from '../middleware/upload.ts';

const router = express.Router();

// make sure to protect to get access to the user token
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.get("/reset-password/:token", verifyResetToken);
router.put("/reset-password/:token", resetPassword);
router.post("/logout", logout);
router.get("/profile", protect, getUserProfile);
router.put("/profile/photo", protect, parseProfilePhoto, updateProfilePhoto);
router.delete("/profile/photo", protect, removeProfilePhoto);

// Teachers should be able to fetch all students
router.get(
    "/",
    protect,
    authorize(["admin", "teacher"]),
    getUsers
);

// Either use put or patch
router.put(
    "/update/:id",
    protect,
    authorize(["admin", "teacher"]),
    updateUser
);

router.delete(
    "/delete/:id",
    protect,
    authorize(["admin", "teacher"]),
    deleteUser
);

//(only admin/teacher can create users)
router.post("/create-user", protect, authorize(["admin", "teacher"]), register);

export default router;