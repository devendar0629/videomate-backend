import { Worker } from "bullmq";
import { transcodeVideo } from "../processors/transcode-video";
import { connectDB } from "../lib/db";

async function initVideoWorker() {
    await connectDB().then(() => {
        console.log(
            "✅ VideoWorker :: Connected to the database successfully."
        );
    });

    const videoWorker = new Worker("transcode-video", transcodeVideo, {
        connection: {
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT || "6379"),
            password: process.env.REDIS_PASSWORD,
        },
    });

    videoWorker.on("ready", () => {
        console.log("✨ VideoWorker is ready.");
    });
}

initVideoWorker().catch((err) => {
    console.error("❌ VideoWorker :: Failed to initialize video worker:", err);
});
