import { type Request, type Response } from "express";
import User from "../models/user";
import { generateToken } from "../utils/generateToken";
import { logActivity } from "../utils/activitieslog";
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
            if((req as any).user) {
                await logActivity({
                    userId: (req as any).user._id,
                    action: "User Registration",
                    details: `Registered new user with email: ${newUser.email}`,
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
    if (user && await user.matchPassword(password)) {
        // generate token
        generateToken(user._id.toString(), res);
        res.json(user)
    } else {    
        res.status(401).json({ message: "Invalid email or password" });
    }
    } catch (error) {
        res.status(500).json({ message: "Server Error", error});
    }
}