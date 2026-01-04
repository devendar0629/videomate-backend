import { Router } from "express";

import { ping } from "../controllers/api.controller";

const router = Router();

router.get("/ping", ping);

import videoRouter from "./video.route";

router.use("/videos", videoRouter);

export default router;
