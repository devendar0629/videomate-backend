import { Router } from "express";
import {
    getCurrentUser,
    login,
    logout,
    renewTokens,
    signup,
} from "../controllers/auth.controller";
import {
    ensureAccessAndRefreshTokens,
    ensureRefreshToken,
} from "../middlewares/auth.middleware";

const router = Router();

// ---------------  PUBLIC ROUTES -----------------

router.post("/login", login);
router.post("/signup", signup);

// ---------------  PROTECTED ROUTES -----------------

router.post("/logout", ensureAccessAndRefreshTokens, logout);
router.post("/token", ensureRefreshToken, renewTokens);
router.get("/me", ensureAccessAndRefreshTokens, getCurrentUser);

export default router;
