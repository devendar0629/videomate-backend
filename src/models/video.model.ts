import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            default: "Untitled Video",
            trim: true,
        },
        description: {
            type: String,
            default: "",
            trim: true,
        },
        uniqueFileName: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        originalFileName: {
            type: String,
            required: true,
            trim: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        availableResolutions: {
            type: [String],
            enum: [
                "4k",
                "1440p",
                "1080p",
                "720p",
                "480p",
                "360p",
                "240p",
                "144p",
            ],
            default: [],
        },
        status: {
            type: String,
            required: true,
            enum: ["processing", "finished", "waiting", "error"],
            default: "waiting",
        },
        visibility: {
            type: String,
            default: "private",
            required: true,
            enum: ["public", "private"],
        },
        errorMessage: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
);

export type TVideo = mongoose.InferSchemaType<typeof videoSchema>;
const Video = mongoose.model<TVideo>("Video", videoSchema);

export default Video;
