import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import settings from "../../settings.js";

const ensureAccessToken: RequestHandler = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            errorCode: "UNAUTHORIZED",
            error: "Unauthorized request",
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            errorCode: "UNAUTHORIZED",
            error: "Unauthorized request",
        });
    }

    try {
        const decodedPayload = jwt.verify(token, settings.ACCESS_TOKEN_SECRET!);

        const expTime =
            (decodedPayload as any).iat * 1000 +
            settings.ACCESS_TOKEN_EXP_SECS * 1000;

        if (Date.now() > expTime) {
            return res.status(401).json({
                errorCode: "INVALID_TOKEN",
                error: "Unauthorized request",
            });
        }

        (req as any).user = decodedPayload;

        return next();
    } catch {
        return res.status(401).json({
            errorCode: "INVALID_TOKEN",
            error: "Unauthorized request",
        });
    }
};

const ensureRefreshToken: RequestHandler = async (req, res, next) => {
    const refreshToken = req.cookies.session_token;

    if (!refreshToken) {
        return res.status(401).json({
            errorCode: "UNAUTHORIZED",
            error: "Unauthorized request",
        });
    }

    try {
        const decodedPayload = jwt.verify(
            refreshToken,
            settings.REFRESH_TOKEN_SECRET!
        );

        const expTime =
            (decodedPayload as any).iat * 1000 +
            settings.REFRESH_TOKEN_EXP_SECS * 1000;

        if (Date.now() > expTime) {
            return res.status(401).json({
                errorCode: "INVALID_TOKEN",
                error: "Unauthorized request",
            });
        }

        (req as any).user = decodedPayload;

        return next();
    } catch {
        return res.status(401).json({
            errorCode: "INVALID_TOKEN",
            error: "Unauthorized request",
        });
    }
};

const ensureAccessAndRefreshTokens: RequestHandler = async (req, res, next) => {
    await ensureAccessToken(req, res, async () => {
        await ensureRefreshToken(req, res, next);
    });
};

export { ensureAccessToken, ensureRefreshToken, ensureAccessAndRefreshTokens };
