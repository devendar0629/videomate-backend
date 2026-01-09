import { Router } from "express";
import getMulterMiddleware from "../lib/multer";
import settings from "../../settings";

const router = Router();

// --------------------------------- MIDDLEWARES ---------------------------------

import { ensureAccessToken } from "../middlewares/auth.middleware";
router.use(ensureAccessToken);

// --------------------------------- ROUTES ---------------------------------

import {
    deleteVideo,
    getAll,
    get,
    publish,
    search,
    watch,
    edit,
} from "../controllers/video.controller";

router.post(
    "/publish",

    getMulterMiddleware({
        limits: {
            fileSize: settings.MAX_VIDEO_FILE_SIZE_BYTES,
        },
    }).single("file"),

    publish
);

router.get("/all", getAll);
router.get("/search", search);
router.get("/watch/:videoId", watch);
router.get("/:videoId", get);
router.delete("/:videoId", deleteVideo);
router.patch(
    "/:videoId",

    getMulterMiddleware({
        limits: {
            fileSize: settings.MAX_VIDEO_FILE_SIZE_BYTES,
        },
    }).single("file"),

    edit
);

export default router;
