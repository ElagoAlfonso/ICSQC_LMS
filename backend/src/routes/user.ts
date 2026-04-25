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

// next part is to protect the routes, also add a rolebased access