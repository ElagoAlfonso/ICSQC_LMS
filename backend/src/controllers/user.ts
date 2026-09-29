import { type Request, type Response } from "express";
import User from "../models/user.ts";
import { generateToken } from "../utils/generateToken.ts";
import { logActivity } from "../utils/activitieslog.ts";
import type { AuthRequest } from "../middleware/auth.ts";
import { createNotifications } from "../utils/notifications.ts";
import {
    isIcsqcEmail,
    isStrongPassword,
    normalizeEmail,
    passwordRequirementsMessage,
} from "../utils/authValidation.ts";

//  @desc    Register a new user
//  @route   POST /api/users/register
//  @access  Private (Admin & Teacher only)

export const register = async (
    req: Request,
    res: Response): Promise<void> => {
    try{
        const {
            name,
            email,
            lrn,
            password,
            role,
            studentClass,
            teacherSubject,
            isActive
        } = req.body;
        const requestingUser = (req as AuthRequest).user;

        // Check if user already exists
        const normalizedEmail = normalizeEmail(email);
        if (!isIcsqcEmail(normalizedEmail)) {
            res.status(400).json({ message: "Please use your official ICSQC email address (lastname.icsqc@gmail.com)." });
            return;
        }
        if (!isStrongPassword(password)) {
            res.status(400).json({ message: passwordRequirementsMessage });
            return;
        }

        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            res.status(400).json({ message: "User already exists" });
            return;
        }

        // Create new user
        const newUser = await User.create({
            name,
            email: normalizedEmail,
            lrn: role === "student" ? String(lrn || "").trim() : undefined,
            password,
            role: requestingUser?.role === "admin" ? role : "student",
            studentClass: requestingUser ? studentClass : undefined,
            teacherSubject: requestingUser ? teacherSubject : undefined,
            isActive: requestingUser ? isActive : true,
        });

        if (newUser) {
            const admins = await User.find({ role: "admin", isActive: true }).select("_id");
            await createNotifications(admins.map((admin) => admin._id), {
                title: "New user registration",
                message: `${newUser.name} registered as a ${newUser.role}.`,
                type: "user",
                relatedResource: newUser._id,
            });
            // We don't have req.user type defined , so we use a type assertion to access
            if ((req as any).user) {  // logged-in admin/teacher
                await logActivity({
                    userId: (req as any).user._id,  // admin/teacher doing the creation
                    action: "CREATE_USER",
                    details: `Admin/Teacher ${ (req as any).user.email } created user ${newUser.email}`,
                });
         } else {
        // Self-registration
        await logActivity({
          userId: newUser._id.toString(),
          action: "REGISTER",
          details: `User ${newUser.email} registered`,
        });
      }
            res.status(201).json({
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                lrn: newUser.lrn,
                role: newUser.role,
                isActive: newUser.isActive,
                studentClass: newUser.studentClass,
                teacherSubjects: newUser.teacherSubject,
                message: "User registered successfully",
            })
        } else {
            res.status(400).json({ message: "Invalid user data" });
        }
 }catch {
     res.status(500).json({ message: "Server error" });
    }
};

// @desc   Auth user and get token
// @route  POST /api/users/login
// @access Public

export const login = async  (req: Request, res: Response): Promise<void> => {
    try{
    if (!process.env.JWT_SECRET) {
        res.status(503).json({ message: "Login is unavailable because JWT_SECRET is not configured" });
        return;
    }

    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (!isIcsqcEmail(email)) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
    }
    const user = await User.findOne({ email });

    // Check if user exists and password matches
    if (user?.isActive && (await user.matchPassword(password))) {
        // generate token and log activity
        generateToken(user._id.toString(), res);
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            studentClass: user.studentClass,
            teacherSubject: user.teacherSubject,
        });
    } else {
        res.status(401).json({ message: "Invalid email or password" });
    }
    } catch {
        res.status(500).json({ message: "Server Error" });
    }
};
//  @desc    Update user (Admin)
//  @route   POST /api/users/:id
//  @access  Private /Admin

export const updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await User.findById(req.params.id);
        // We cannot return something here (res.json) so the client is still waiting for response.
        if (user) {
            const requestingUser = (req as AuthRequest).user;
            if (requestingUser?.role === "teacher" && user.role !== "student") {
                res.status(403).json({ message: "Teachers can only manage student accounts." });
                return;
            }
            if (requestingUser?.role === "teacher" && req.body.role && req.body.role !== "student") {
                res.status(403).json({ message: "Teachers cannot assign privileged roles." });
                return;
            }
            const normalizedEmail = normalizeEmail(req.body.email || user.email);
            if (!isIcsqcEmail(normalizedEmail)) {
                res.status(400).json({ message: "Please use your official ICSQC email address (lastname.icsqc@gmail.com)." });
                return;
            }
            if (req.body.password && !isStrongPassword(req.body.password)) {
                res.status(400).json({ message: passwordRequirementsMessage });
                return;
            }
            user.name = req.body.name || user.name;
            user.email = normalizedEmail;
            user.role = req.body.role || user.role;
            user.lrn = user.role === "student" ? String(req.body.lrn ?? user.lrn ?? "").trim() : undefined;
            user.isActive = req.body.isActive !== undefined ? req.body.isActive : user.isActive;
            user.studentClass = req.body.studentClass || user.studentClass;
            user.teacherSubject = req.body.teacherSubject || user.teacherSubject;
            if(req.body.password) {
                user.password = req.body.password;
            }
            const updatedUser = await user.save();
            // It is working from here
            if ((req as any).user) {
                // we are passing userId as objectId instead of string
                await logActivity({
                    userId: (req as any).user._id,
                    action: "Update User",
                    details: `Updated user with email:  ${updatedUser.email}`,
                });
            }
            //This handles the response to the clients update request, so it is working from here
            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                lrn: updatedUser.lrn,
                role: updatedUser.role,
                isActive: updatedUser.isActive,
                studentClass: updatedUser.studentClass,
                teacherSubjects: updatedUser.teacherSubject,
                message: "User updated successfully",
            });
        }else {
            res.status(404).json({ message: "User not found" });
        }
    }catch {
        res.status(500).json({ message: "Server Error" });
    }
}

// @desc   Get user (With Pagination and Filtering)
// @route  GET /api/users/:id
// @access  Private/Admin
export const getUsers = async (req: Request, res: Response) => {
    try{
        const page = parseInt(req.query.page as string) || 1; // Default to page 1
        const limit = parseInt(req.query.limit as string) || 10; // Default to 10 items per page
        const role = req.query.role as string; // Optional role filter
        const search = req.query.search as string; // Optional: Can add search later
        const skip = (page - 1) * limit;
        const filter: any = {};

        if ((req as AuthRequest).user?.role === "teacher") {
            filter.role = "student";
        } else if (role && role !== "all" && role !== "") { // Filter by role if provided
            filter.role = role;
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { lrn: { $regex: search, $options: "i" } },
            ];
        }

        const users = await User.find(filter)
            .select("-password")
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const totalUsers = await User.countDocuments(filter);
        const totalPages = Math.ceil(totalUsers / limit);

        res.json({
            users,
            pagination: {
                currentPage: page,
                totalPages,
                totalUsers,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
        });
    }catch {
        res.status(500).json({ message: "Server Error" });
    }
}

// @desc   Get user profile
// @route  GET /api/users/profile
// @access Private
export const getUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "Not authorized" });
            return;
        }

        const user = await User.findById(req.user._id).select("-password");
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch {
        res.status(500).json({ message: "Server Error" });
    }
};

// @desc   Delete user
// @route  DELETE /api/users/:id
// @access Private/Admin
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            if ((req as AuthRequest).user?.role === "teacher" && user.role !== "student") {
                res.status(403).json({ message: "Teachers can only manage student accounts." });
                return;
            }
            await User.deleteOne({ _id: req.params.id });

            if ((req as any).user) {
                await logActivity({
                    userId: (req as any).user._id,
                    action: "Delete User",
                    details: `Deleted user with email: ${user.email}`,
                });
            }

            res.json({ message: "User deleted successfully" });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch {
        res.status(500).json({ message: "Server Error" });
    }
};

// @desc   Logout user
// @route  POST /api/users/logout
// @access Private
export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        // Clear the JWT cookie
        res.clearCookie("jwt", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
            path: "/",
        });
        res.json({ message: "Logged out successfully" });
    } catch {
        res.status(500).json({ message: "Server Error" });
    }
};

