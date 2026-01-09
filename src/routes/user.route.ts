import { Router } from "express";
import { editDetails, getProfile } from "../controllers/user.controller";
import { ensureAccessToken } from "../middlewares/auth.middleware";
import getMulterMiddleware from "../lib/multer";
import settings from "../../settings";

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
