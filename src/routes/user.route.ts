import { Router } from "express";
import { editDetails, getProfile } from "../controllers/user.controller.js";
import { ensureAccessToken } from "../middlewares/auth.middleware.js";
import getMulterMiddleware from "../lib/multer.js";
import settings from "../../settings.js";

const router = Router();

router.use(ensureAccessToken);

router.patch(
    "/profile",

    getMulterMiddleware(
        {
            limits: {
                fileSize: 2 * 1024 * 1024,
            },
        },
        settings.AVATARS_DIR
    ).single("file"),

    editDetails
);

router.get("/profile", getProfile);

export default router;
