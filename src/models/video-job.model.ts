import mongoose from "mongoose";

const videoJobSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            required: true,
            enum: ["transcode", "generate_thumbnail"],
        },
        videoId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Video",
        },
        jobId: {
            type: String,
            required: true,
            unique: true,
        },
    },
    { timestamps: true }
);

export type TVideoJob = mongoose.InferSchemaType<typeof videoJobSchema>;
const VideoJob = mongoose.model<TVideoJob>("VideoJob", videoJobSchema);

export default VideoJob;
