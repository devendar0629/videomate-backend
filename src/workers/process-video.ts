import { Worker } from "bullmq";
import { processVideo } from "../processors/process-video";
import { connectDB } from "../lib/db";

async function initVideoProcessorWorker() {
    await connectDB().then(() => {
        console.log(
            "✅ VideoProcessor Worker :: Connected to the database successfully."
        );
    });

    // Create a new BullMQ worker for video transcoding
    const videoProcessorWorker = new Worker(
        "process-video-queue",
        processVideo,
        {
            connection: {
                host: process.env.REDIS_HOST,
                port: parseInt(process.env.REDIS_PORT || "6379"),
                password: process.env.REDIS_PASSWORD,
            },
        }
    );

    videoProcessorWorker.on("ready", () => {
        console.log("✨ VideoProcessor Worker is ready.");
    });
}

initVideoProcessorWorker().catch((err) => {
    console.error(
        "❌ VideoProcessor Worker :: Failed to initialize video worker:",
        err
    );
});
