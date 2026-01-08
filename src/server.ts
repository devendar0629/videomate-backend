import e from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import settings from "../settings";

const app = e();

app.use(e.json());
app.use(e.urlencoded({ extended: true }));
app.use(
    cors({
        origin: process.env.CORS_ALLOWED_ORIGINS?.split(", "),
        credentials: true,
    })
);
app.use(cookieParser());

app.use("/uploads", e.static(settings.UPLOADS_DIR));
app.use("/videos", e.static(settings.OUTPUT_VIDEOS_DIR));
app.use("/avatars", e.static(settings.AVATARS_DIR));

// -------------- ROUTING --------------

import apiRouter from "./routes/api.route";
import authRouter from "./routes/auth.route";

app.use("/api", apiRouter);
app.use("/auth", authRouter);

// -------------- ROUTING --------------

export default app;
