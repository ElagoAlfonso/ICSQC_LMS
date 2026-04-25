import e, { type Request, type Response } from "express";
import User from "../models/user";
import { generateToken } from "../utils/generateToken";
import { logActivity } from "../utils/activitieslog";
import type { Auth } from "mongodb";
import type { AuthRequest } from "../middleware/auth";
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
            password,
            role,
            studentClass,
            teacherSubject,
            isActive
        } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400).json({ message: "User already exists" });
            return;
        }

        // Create new user
        const newUser = await User.create({
            name,
            email,
            password,
            role,
            studentClass,
            teacherSubject,
            isActive,
        });

        if (newUser) {
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
                role: newUser.role,
                isActive: newUser.isActive,
                studentClass: newUser.studentClass,
                teacherSubjects: newUser.teacherSubject,
                message: "User registered successfully",
            })
        } else {
            res.status(400).json({ message: "Invalid user data" });
        }
 }catch (error) {
        res.status(500).json({ message: "Server error" , error});
    }
};

// @desc   Auth user and get token
// @route  POST /api/users/login
// @access Public

export const login = async  (req: Request, res: Response): Promise<void> => {
    try{
    const {email,password} = req.body;
    const user = await User.findOne({ email });

    // Check if user exists and password matches
    if (user && (await user.matchPassword(password))) {
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
    } catch (error) {
        res.status(500).json({ message: "Server Error", error});
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
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.role = req.body.role || user.role;
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
                role: updatedUser.role,
                isActive: updatedUser.isActive,
                studentClass: updatedUser.studentClass,
                teacherSubjects: updatedUser.teacherSubject,
                message: "User updated successfully",
            });
        }else {
            res.status(404).json({ message: "User not found" });
        }
    }catch (error) {
        res.status(500).json({ message: "Server Error", error});
    }
}

// @desc   Get user (With Pagination(ddividing large datasets or content into smaller chunks) and Filtering)
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

        if (role && role !== "all" && role !== "") { // Filter by role if provided
            filter.role = role;
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }
        // Fetch users with pagination and filtering
        const [total, users] = await Promise.all([
            User.countDocuments(filter), // Get total count for pagination
            User.find(filter)
            .select("-password") // Exclude password field
         // .populate("studentClass", "_id name section") 
         // .populate("teacherSubject", "_id name section") 
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        ]);

        // Send response
        res.json({
            users,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit,
            }
        })
    } catch (error) {
        res.status(500).json({ message: "Server Error", error});
    }
};

// next
// @desc   Delete user (Admin)
// @route  DELETE /api/users/:id
// @access  Private/Admin

export const deleteUser = async (req: Request, res: Response) => {
     try{
        const user = await User.findById(req.params.id);
        if (user) {
            await user.deleteOne();
            if ((req as any).user) {
                // we are passing userId as objectId instead of string
                await logActivity({
                    userId: (req as any).user._id,
                    action: "Delete User",
                    details: `Deleted user with email:  ${user.email}`,
                });
            }
            res.json({ message: "User deleted successfully" });
        } else {
            res.status(404).json({ message: "User not found" });
        }
        } catch (error) {
    res.status(500).json({ message: "Server Error", error});
    }  
};

// @desc   get user profile (via cookie)
// @route  GET /api/users/profile
// @access  Private

export const getUserProfile = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user) {
            res.json({
                user: {
                    _id: req.user._id,
                    name: req.user.name,
                    email: req.user.email,
                    role: req.user.role,
                }
        });
        }else{
            res.status(401).json({ message: "Not authorized" });
        }
    } catch (error) {
        res.status(500).json({ message: "Server Error", error});
    }   
};

// @desc   Logout user  / clear cookie 
// @route  POST /api/users/logout
// @access  Public

export const logout = async (req: Request, res: Response) => {
    try {
        res.cookie("jwt", "", {
            httpOnly: true,
            expires: new Date(0), // To expire the cookie immediately
        });
        res.json({ message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error});
    }
};