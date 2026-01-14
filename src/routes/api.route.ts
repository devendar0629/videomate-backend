import { Router } from "express";

import { ping } from "../controllers/api.controller.js";

const router = Router();

router.get("/ping", ping);

import videoRouter from "./video.route.js";
import userRouter from "./user.route.js";

router.use("/videos", videoRouter);
router.use("/users", userRouter);

export default router;
