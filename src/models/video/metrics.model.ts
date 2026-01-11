import mongoose from "mongoose";

const videoMetricsSchema = new mongoose.Schema(
    {
        videoId: {
            type: String,
            required: true,
            unique: true,
        },
        views: {
            type: Number,
            default: 0,
        },
        likes: {
            type: Number,
            default: 0,
        },
        dislikes: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

export type TVideoMetrics = mongoose.InferSchemaType<typeof videoMetricsSchema>;
const VideoMetrics = mongoose.model<TVideoMetrics>(
    "VideoMetrics",
    videoMetricsSchema
);

export default VideoMetrics;
