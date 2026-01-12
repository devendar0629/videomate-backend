import type { RequestHandler } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import settings from "../../settings";
import videoProcessQueue from "../queues/process-video";
import Video, { type TVideo } from "../models/video/video.model";
import VideoJob from "../models/video/job.model";
import z from "zod";
import { formatZodErrors, mongooseObjectIdValidator } from "../utils/helpers";
import User from "../models/user.model";
import mongoose from "mongoose";
import VideoMetrics from "../models/video/metrics.model";
import VideoReaction from "../models/video/reaction.model";

// --------------------------------- VALIDATION SCHEMAS ---------------------------------

const _publishSchema = z.strictObject(
    {
        file: z
            .custom<Express.Multer.File>()
            .refine((file) => !!file, {
                error: "A valid video file is required",
            })
            .refine((file) => !!file && file.mimetype.startsWith("video/"), {
                error: "Uploaded file must be a video",
            })
            .refine((file) => !!file && file.size <= 500 * 1024 * 1024, {
                error: "Video file size must not exceed 500MB",
            }),

        title: z
            .string("Invalid title")
            .trim()
            .min(1, "Title should not be empty"),
        description: z
            .string()
            .trim()
            .max(1024, "Description can have a maximum of 1024 characters")
            .optional(),
        visibility: z
            .enum(
                ["public", "private"],
                "Visibility must be either 'public' or 'private'"
            )
            .default("private"),
    },
    "Invalid payload"
);

const _editSchema = z
    .strictObject(
        {
            title: _publishSchema.shape.title.optional(),
            description: _publishSchema.shape.description.optional(),
            visibility: z
                .enum(
                    ["public", "private"],
                    "Visibility must be either 'public' or 'private'"
                )
                .optional(),
            file: _publishSchema.shape.file.optional(),
        },
        "Invalid payload"
    )
    .refine(
        (data) => {
            return Array.from(Object.values(data)).some(
                (val) => val !== undefined
            );
        },
        {
            message: "At least one field must be provided for update",
        }
    );

// --------------------------------- CONTROLLERS ---------------------------------

const publish: RequestHandler = async (req, res) => {
    const reqBody = req.body;

    const bodyParseResult = _publishSchema.safeParse({
        file: req.file,
        title: reqBody.title,
        description: reqBody.description,
        visibility: reqBody.visibility,
    });

    if (!bodyParseResult.success) {
        return res.status(400).json({
            message: "Invalid payload",
            errors: formatZodErrors(bodyParseResult.error.issues),
            errorCode: "INVALID_PAYLOAD",
        });
    }

    const {
        file: videoFile,
        title,
        description,
        visibility,
    } = bodyParseResult.data;

    // Ensure a file was uploaded
    if (!videoFile) {
        return res.status(400).json({
            message: "No video file uploaded",
            errCode: "INVALID_PAYLOAD",
        });
    }

    const videoFilePath = videoFile.path;
    const videoOutputPath = path.join(
        settings.OUTPUT_VIDEOS_DIR,
        videoFile.filename
    );

    const newVideoDoc = await Video.create({
        originalFileName: videoFile.originalname,
        uniqueFileName: videoFile.filename,
        title,
        description,
        visibility,
        path: videoFilePath,
        uploader: req.user?.id,
    });

    const [_, videoProcessJob] = await Promise.all([
        User.findByIdAndUpdate(req.user?.id, {
            $push: { videos: newVideoDoc._id },
        }),
        videoProcessQueue.add("process", {
            videoPath: videoFilePath,
            outputPath: videoOutputPath,
            videoDocId: newVideoDoc._id,
        }),
    ]);

    await Promise.all([
        VideoJob.create({
            jobId: videoProcessJob.id,
            videoId: newVideoDoc._id,
        }),
        VideoMetrics.create({
            videoId: newVideoDoc._id.toString(),
        }),
    ]);

    return res.status(202).json({
        message: "Video upload accepted.",
        videoId: newVideoDoc._id,
    });
};

const getAll: RequestHandler = async (req, res) => {
    const page = parseInt((req.query.page as string) ?? "1", 10);
    const limit = parseInt((req.query.limit as string) ?? "10", 10);

    const aggregatedVideos = await Video.aggregate([
        {
            $match: {
                uploader: new mongoose.Types.ObjectId(req.user?.id),
            },
        },
        {
            $lookup: {
                from: "videometrics",
                as: "metrics",
                let: { videoIdStr: { $toString: "$_id" } },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ["$videoId", "$$videoIdStr"],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            views: 1,
                            likes: 1,
                            dislikes: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: {
                path: "$metrics",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $sort: { createdAt: -1 },
        },
        {
            $project: {
                uploader: 0,
                __v: 0,
            },
        },
        {
            $skip: (page - 1) * limit,
        },
        {
            $limit: limit,
        },
    ]);

    return res.status(200).json(aggregatedVideos);
};

const get: RequestHandler = async (req, res) => {
    const videoId = req.params.videoId;

    if (!mongooseObjectIdValidator.safeParse(videoId).success) {
        return res.status(400).json({
            message: "Invalid video ID",
            errorCode: "INVALID_VIDEO_ID",
        });
    }

    const aggregation = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId),
                uploader: new mongoose.Types.ObjectId(req.user?.id),
            },
        },
        {
            $lookup: {
                from: "videometrics",
                as: "metrics",
                let: { videoIdStr: { $toString: "$_id" } },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ["$videoId", "$$videoIdStr"],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            views: 1,
                            likes: 1,
                            dislikes: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: {
                path: "$metrics",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $project: {
                uploader: 0,
                __v: 0,
            },
        },
        {
            $limit: 1,
        },
    ]);

    const videoDoc = await Video.findOne({
        _id: videoId,
        uploader: req.user?.id,
    }).select(["-uploader", "-__v"]);

    if (!videoDoc) {
        return res.status(404).json({
            message: "Video not found",
            errorCode: "NOT_FOUND",
        });
    }

    return res.status(200).json(aggregation[0]);
};

const deleteVideo: RequestHandler = async (req, res) => {
    const videoId = req.params.videoId;

    if (!mongooseObjectIdValidator.safeParse(videoId).success) {
        return res.status(400).json({
            message: "Invalid video ID",
            errorCode: "INVALID_VIDEO_ID",
        });
    }

    const videoDoc = await Video.findOne({
        _id: videoId,
        uploader: req.user?.id,
    });

    if (!videoDoc) {
        return res.status(404).json({
            message: "Video not found",
            errCode: "NOT_FOUND",
        });
    }

    const videoJob = await VideoJob.findOne({ videoId: videoDoc._id });

    await Promise.all([
        videoDoc.deleteOne(),
        VideoMetrics.deleteOne({ videoId: videoDoc._id.toString() }),
    ]);

    if (videoJob) {
        await videoProcessQueue.remove(videoJob.jobId);
        await videoJob.deleteOne().catch(() => {});
    }

    await Promise.all([
        // Delete video files
        fs
            .rmdir(
                path.join(settings.OUTPUT_VIDEOS_DIR, videoDoc.uniqueFileName),
                {
                    recursive: true,
                }
            )
            .catch(() => {}),

        // Delete original uploaded file
        fs
            .unlink(
                path.join(settings.BASE_DIR, "uploads", videoDoc.uniqueFileName)
            )
            .catch(() => {}),

        VideoReaction.deleteMany({ videoId: videoDoc._id }), // ENHANCEMENT: Consider using a background job to improve performance
    ]);

    return res.status(204).json({});
};

const search: RequestHandler = async (req, res) => {
    const query = req.query.q as string;
    const page = parseInt((req.query.page as string) ?? "1", 10);
    const limit = parseInt((req.query.limit as string) ?? "10", 10);

    if (query?.trim()?.length === 0) {
        return res.status(400).json({
            message: "Query cannot be empty",
            errCode: "INVALID_QUERY",
        });
    }

    const matchingVideos = await Video.aggregate([
        {
            $match: {
                visibility: "public",
                status: "finished",
                title: { $regex: query, $options: "i" },
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "uploader",
                foreignField: "_id",
                as: "uploader",
                pipeline: [
                    {
                        $project: {
                            _id: 0,
                            name: 1,
                            avatar: 1,
                        },
                    },
                ],
            },
        },
        {
            $project: {
                title: 1,
                description: 1,
                uniqueFileName: 1,
                availableResolutions: 1,
                createdAt: 1,
                uploader: 1,
                duration: 1,
            },
        },
        {
            $unwind: {
                path: "$uploader",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: "videometrics",
                let: { videoIdStr: { $toString: "$_id" } },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ["$videoId", "$$videoIdStr"],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            views: 1,
                            likes: 1,
                            dislikes: 1,
                        },
                    },
                ],
                as: "metrics",
            },
        },
        {
            $unwind: {
                path: "$metrics",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $sort: {
                "metrics.views": -1,
                createdAt: -1,
            },
        },
        {
            $skip: (page - 1) * limit,
        },
        {
            $limit: limit,
        },
    ]);

    return res.status(200).json(matchingVideos);
};

const watch: RequestHandler = async (req, res) => {
    const videoId = req.params.videoId;

    if (!mongooseObjectIdValidator.safeParse(videoId).success) {
        return res.status(400).json({
            message: "Invalid video ID",
            errorCode: "INVALID_VIDEO_ID",
        });
    }

    const videoDocs = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId),
                visibility: "public",
                status: "finished",
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "uploader",
                foreignField: "_id",
                as: "uploader",
                pipeline: [
                    {
                        $project: {
                            name: 1,
                            avatar: 1,
                        },
                    },
                ],
            },
        },
        {
            $unwind: {
                path: "$uploader",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            // Also compute if the uploader is watching their own video
            $addFields: {
                isUploader: {
                    $eq: [
                        "$uploader._id",
                        new mongoose.Types.ObjectId(req.user?.id),
                    ],
                },
            },
        },
        {
            $lookup: {
                // Fetch the reaction of the current user (if any)
                from: "videoreactions",
                let: { videoObjectId: "$_id" },
                as: "reaction",
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$videoId", "$$videoObjectId"] },
                                    {
                                        $eq: [
                                            "$userId",
                                            new mongoose.Types.ObjectId(
                                                req.user?.id
                                            ),
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                    {
                        $project: {
                            reaction: 1,
                            _id: 0,
                        },
                    },
                ],
            },
        },
        {
            $addFields: {
                reaction: {
                    // If no reaction, set to null
                    $cond: {
                        if: { $eq: [{ $size: "$reaction" }, 0] },
                        then: null,
                        else: "$reaction",
                    },
                },
            },
        },
        {
            $unwind: {
                path: "$reaction",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $replaceRoot: {
                newRoot: {
                    $mergeObjects: ["$$ROOT", "$reaction"],
                },
            },
        },
        {
            $project: {
                uniqueFileName: 1,
                title: 1,
                description: 1,
                previewImage: 1,
                uploader: 1,
                availableResolutions: 1,
                createdAt: 1,
                isUploader: 1,
                reaction: 1,
                duration: 1,
            },
        },
        {
            $lookup: {
                from: "videometrics",
                let: { videoIdStr: { $toString: "$_id" } },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $eq: ["$videoId", "$$videoIdStr"],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 0,
                            views: 1,
                            likes: 1,
                            dislikes: 1,
                        },
                    },
                ],
                as: "metrics",
            },
        },
        {
            $unwind: {
                path: "$metrics",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $limit: 1,
        },
    ]);

    if (videoDocs.length <= 0) {
        return res.status(404).json({
            message: "Video not found",
            errorCode: "NOT_FOUND",
        });
    }

    const video = videoDocs[0];

    if (!video.isUploader) {
        await VideoMetrics.findOneAndUpdate(
            { videoId },
            { $inc: { views: 1 } }
        );
    }

    delete video.uploader._id;

    return res.status(200).json(video);
};

const edit: RequestHandler = async (req, res) => {
    const videoId = req.params.videoId;

    if (!mongooseObjectIdValidator.safeParse(videoId).success) {
        return res.status(400).json({
            message: "Invalid video ID",
            errorCode: "INVALID_VIDEO_ID",
        });
    }

    const bodyParseResult = _editSchema.safeParse({
        file: req.file,
        ...req.body,
    });

    if (!bodyParseResult.success) {
        return res.status(400).json({
            message: "Invalid payload",
            errors: formatZodErrors(bodyParseResult.error.issues),
            errorCode: "INVALID_PAYLOAD",
        });
    }

    const dataToUpdate: Partial<{
        title: string;
        description: string;
        visibility: "public" | "private";
        file: Express.Multer.File | null;
    }> = {};

    Object.entries(bodyParseResult.data).forEach(([key, val]) => {
        if (val !== undefined) {
            (dataToUpdate as any)[key] = val;
        }
    });

    const videoDoc = await Video.findOneAndUpdate(
        {
            _id: videoId,
            uploader: req.user?.id,
        },
        dataToUpdate,
        { new: true }
    ).select(["-uploader", "-__v"]);

    if (!videoDoc) {
        return res.status(404).json({
            message: "Video not found",
            errorCode: "VIDEO_NOT_FOUND",
        });
    }

    if (dataToUpdate.file) {
        const oldVideoPath = path.join(
            settings.OUTPUT_VIDEOS_DIR,
            videoDoc.uniqueFileName
        );

        const newVideoPath = path.join(
            settings.OUTPUT_VIDEOS_DIR,
            dataToUpdate.file.filename
        );

        const videoProcessJob = await videoProcessQueue.add("process", {
            videoPath: dataToUpdate.file.path,
            outputPath: newVideoPath,
            videoDocId: videoDoc._id,
            oldVideoPath,
            newOriginalFileName: dataToUpdate.file.originalname,
        });

        await VideoJob.create({
            jobId: videoProcessJob.id,
            videoId: videoDoc._id,
        });

        videoDoc.status = "waiting";
        await videoDoc.save();
    }

    return res.status(200).json({
        message: "Video updated successfully",
        data: videoDoc,
    });
};

const like: RequestHandler = async (req, res) => {
    const videoId = req.params.videoId;

    if (!mongooseObjectIdValidator.safeParse(videoId).success) {
        return res.status(400).json({
            message: "Invalid video ID",
            errorCode: "INVALID_VIDEO_ID",
        });
    }

    const video = await Video.findOne({
        _id: videoId,
        visibility: "public",
        status: "finished",
    });

    if (!video) {
        return res.status(404).json({
            error: "Video not found",
            errorCode: "NOT_FOUND",
        });
    }

    if (video.uploader.toString() === req.user?.id) {
        return res.status(400).json({
            error: "You cannot like your own video",
            errorCode: "CANNOT_LIKE_OWN_VIDEO",
        });
    }

    const existingReaction = await VideoReaction.findOne({
        videoId,
        userId: req.user?.id,
    });

    if (!existingReaction) {
        // If no existing reaction, create a new like
        await Promise.all([
            VideoMetrics.findOneAndUpdate(
                { videoId: video._id },
                { $inc: { likes: 1 } }
            ),
            VideoReaction.create({
                videoId: new mongoose.Types.ObjectId(videoId),
                userId: new mongoose.Types.ObjectId(req.user?.id),
                reaction: "like",
            }),
        ]);
    } else {
        if (existingReaction.reaction === "like") {
            // If the existing reaction is a like, remove it (toggle off)
            await Promise.all([
                VideoMetrics.findOneAndUpdate(
                    { videoId: video._id },
                    { $inc: { likes: -1 } }
                ),
                existingReaction.deleteOne(),
            ]);

            return res.status(200).json({
                message: "Reaction updated successfully",
                updatedReaction: null,
            });
        } else {
            // If the existing reaction is a dislike, change it to like
            await Promise.all([
                VideoMetrics.findOneAndUpdate(
                    { videoId: video._id },
                    { $inc: { likes: 1, dislikes: -1 } }
                ),
                existingReaction.updateOne({
                    reaction: "like",
                }),
            ]);
        }
    }

    return res.status(200).json({
        message: "Reaction updated successfully",
        updatedReaction: "like",
    });
};

const dislike: RequestHandler = async (req, res) => {
    const videoId = req.params.videoId;

    if (!mongooseObjectIdValidator.safeParse(videoId).success) {
        return res.status(400).json({
            message: "Invalid video ID",
            errorCode: "INVALID_VIDEO_ID",
        });
    }

    const video = await Video.findOne({
        _id: videoId,
        visibility: "public",
        status: "finished",
    });

    if (!video) {
        return res.status(404).json({
            error: "Video not found",
            errorCode: "NOT_FOUND",
        });
    }

    if (video.uploader.toString() === req.user?.id) {
        return res.status(400).json({
            error: "You cannot dislike your own video",
            errorCode: "CANNOT_DISLIKE_OWN_VIDEO",
        });
    }

    const existingReaction = await VideoReaction.findOne({
        videoId,
        userId: req.user?.id,
    });

    if (!existingReaction) {
        // If no existing reaction, create a new dislike
        await Promise.all([
            VideoMetrics.findOneAndUpdate(
                { videoId: video._id },
                { $inc: { dislikes: 1 } }
            ),
            VideoReaction.create({
                videoId: new mongoose.Types.ObjectId(videoId),
                userId: new mongoose.Types.ObjectId(req.user?.id),
                reaction: "dislike",
            }),
        ]);
    } else {
        if (existingReaction.reaction === "dislike") {
            // If the existing reaction is a dislike, remove it (toggle off)
            await Promise.all([
                VideoMetrics.findOneAndUpdate(
                    { videoId: video._id },
                    { $inc: { dislikes: -1 } }
                ),
                existingReaction.deleteOne(),
            ]);

            return res.status(200).json({
                message: "Reaction updated successfully",
                updatedReaction: null,
            });
        } else {
            // If the existing reaction is a like, change it to dislike
            await Promise.all([
                VideoMetrics.findOneAndUpdate(
                    { videoId: video._id },
                    { $inc: { likes: -1, dislikes: 1 } }
                ),
                existingReaction.updateOne({
                    reaction: "dislike",
                }),
            ]);
        }
    }

    return res.status(200).json({
        message: "Reaction updated successfully",
        updatedReaction: "dislike",
    });
};

export {
    publish,
    get,
    getAll,
    deleteVideo,
    search,
    watch,
    edit,
    like,
    dislike,
};
