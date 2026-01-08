import { Queue } from "bullmq";

const videoProcessQueue = new Queue("process-video-queue", {
    connection: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
        password: process.env.REDIS_PASSWORD,
    },
    defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
    },
});

export default videoProcessQueue;
