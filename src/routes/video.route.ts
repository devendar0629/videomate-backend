import { Router } from "express";
import getMulterMiddleware from "../lib/multer.js";
import settings from "../../settings.js";

const router = Router();

// --------------------------------- MIDDLEWARES ---------------------------------

import { ensureAccessToken } from "../middlewares/auth.middleware.js";
router.use(ensureAccessToken);

// --------------------------------- ROUTES ---------------------------------

import {
    deleteVideo,
    getAll,
    get,
    publish,
    getLikedVideos,
    getDislikedVideos,
    search,
    watch,
    edit,
    like,
    dislike,
} from "../controllers/video.controller.js";

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
router.get("/liked", getLikedVideos);
router.get("/disliked", getDislikedVideos);
router.get("/:videoId/watch", watch);
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
router.post("/:videoId/like", like);
router.post("/:videoId/dislike", dislike);

export default router;
