import mongoose from "mongoose";

const videoReactionSchema = new mongoose.Schema(
    {
        videoId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "Video",
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "User",
        },
        reaction: {
            type: String,
            enum: ["like", "dislike"],
            default: "like",
            required: true,
        },
    },
    { timestamps: true }
);

videoReactionSchema.index(
    {
        videoId: 1,
        userId: 1,
    },
    { unique: true }
);

export type TVideoReaction = mongoose.InferSchemaType<
    typeof videoReactionSchema
>;
const VideoReaction = mongoose.model<TVideoReaction>(
    "VideoReaction",
    videoReactionSchema
);

export default VideoReaction;
