import type { RequestHandler } from "express";
import z from "zod";
import { formatZodErrors } from "../utils/helpers";
import User from "../models/user.model";
import settings from "../../settings";

// ------------------- VALIDATION SCHEMAS -------------------

const _loginSchema = z.strictObject({
    email: z.email("Invalid email address"),
    password: z.string().min(8, {
        error: "Password must be at least 8 characters long",
    }),
});
const _signupSchema = _loginSchema.extend({
    name: z.string().min(2, {
        error: "Name must be at least 2 characters long",
    }),
});

// ------------------- CONTROLLERS -------------------

const login: RequestHandler = async (req, res) => {
    const bodyParseResult = _loginSchema.safeParse(req.body);

    if (!bodyParseResult.success) {
        return res.status(400).json({
            errorCode: "INVALID_PAYLOAD",
            errors: formatZodErrors(bodyParseResult.error.issues),
        });
    }

    const { email, password } = bodyParseResult.data;
    const user = await User.findOne({ email });

    if (!user || !(await user.checkPassword(password))) {
        return res.status(401).json({
            errorCode: "INVALID_CREDENTIALS",
            error: "Invalid credentials",
        });
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    return res
        .status(200)
        .cookie("session_token", refreshToken, {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "lax",
            maxAge: settings.REFRESH_TOKEN_EXP_SECS * 1000,
        })
        .json({
            message: "Login successful",
            accessToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            },
        });
};

const signup: RequestHandler = async (req, res) => {
    const bodyParseResult = _signupSchema.safeParse(req.body);

    if (!bodyParseResult.success) {
        return res.status(400).json({
            errorCode: "INVALID_PAYLOAD",
            errors: formatZodErrors(bodyParseResult.error.issues),
        });
    }

    const { name, email, password } = bodyParseResult.data;

    if (await User.exists({ email })) {
        return res.status(400).json({ errorCode: "EMAIL_TAKEN" });
    }

    await User.create({ name, email, password });

    return res.status(201).json({
        message: "Signup successful",
    });
};

const logout: RequestHandler = async (req, res) => {
    return res
        .status(200)
        .clearCookie("session_token", {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "lax",
        })
        .json({
            message: "Logout successful",
        });
};

const getCurrentUser: RequestHandler = async (req, res) => {
    const userId = (req as any).user.id;
    const user = await User.findById(userId).select("-password");

    if (!user) {
        return res.status(404).json({
            errorCode: "USER_NOT_FOUND",
            error: "User not found",
        });
    }

    return res.status(200).json({
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
        },
        accessToken: user.generateAccessToken(),
    });
};

const renewTokens: RequestHandler = async (req, res) => {
    const userId = (req as any).user.id;

    const user = await User.findById(userId);

    if (!user) {
        // This should never happen as the refresh token is already verified, but just in case
        return res.status(401).json({
            errorCode: "INVALID_TOKEN",
            error: "Invalid token",
        });
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    return res
        .status(200)
        .cookie("session_token", refreshToken, {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "lax",
            maxAge: settings.REFRESH_TOKEN_EXP_SECS * 1000,
        })
        .json({
            message: "Tokens renewed successfully",
            accessToken,
        });
};

export { login, signup, logout, renewTokens, getCurrentUser };
