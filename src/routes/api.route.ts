import { Router } from "express";

import { ping } from "../controllers/api.controller";

const router = Router();

router.get("/ping", ping);

import videoRouter from "./video.route";
import userRouter from "./user.route";

router.use("/videos", videoRouter);
router.use("/users", userRouter);

export default router;
