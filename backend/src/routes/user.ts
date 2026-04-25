<<<<<<< HEAD
import express from 'express';
import { 
    register, 
    login, 
    updateUser, 
    deleteUser, 
    getUserProfile, 
    logout, 
    getUsers
} from '../controllers/user';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// make sure to protect to get access to the user token
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/profile", protect, getUserProfile);

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
=======
import express from "express";

const userRoutes = express.Router();

import { register, login } from "../controllers/user";
import { protect, authorize} from "../middleware/auth";

// make sure to protect to get access to the user token
userRoutes.post("/register", protect, authorize(["admin", "teacher"]),register);
userRoutes.post("/login", login);

export default userRoutes;      
>>>>>>> a77495f626dbe90aaff470650f7e47812e2b1d22

// next part is to protect the routes, also add a rolebased access