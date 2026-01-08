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
    getAllVideos,
    getVideo,
    publish,
    searchVideos,
    watchVideo,
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

router.get("/all", getAllVideos);
router.get("/search", searchVideos);
router.get("/:videoId", getVideo);
router.delete("/:videoId", deleteVideo);
router.get("/watch/:videoId", watchVideo);

export default router;
