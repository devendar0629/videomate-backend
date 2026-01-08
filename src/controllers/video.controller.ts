import type { RequestHandler } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import settings from "../../settings";
import videoProcessQueue from "../queues/process-video";
import Video from "../models/video.model";
import VideoJob from "../models/video-job.model";
import z from "zod";
import { formatZodErrors, mongooseObjectIdValidator } from "../utils/helpers";
import User from "../models/user.model";
import mongoose from "mongoose";

// --------------------------------- VALIDATION SCHEMAS ---------------------------------

const publishSchema = z.strictObject({
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

    title: z.string("Invalid title").trim().min(1, "Title should not be empty"),
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
});

// --------------------------------- CONTROLLERS ---------------------------------

const publish: RequestHandler = async (req, res) => {
    const reqBody = req.body;

    const bodyParseResult = publishSchema.safeParse({
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
        userId: req.user?.id,
    });

    // Add this video to the user's list of videos
    await User.findByIdAndUpdate(req.user?.id, {
        $push: { videos: newVideoDoc._id },
    });

    const videoProcessJob = await videoProcessQueue.add("process", {
        videoPath: videoFilePath,
        outputPath: videoOutputPath,
        videoDocId: newVideoDoc._id,
    });

    await VideoJob.create({
        jobId: videoProcessJob.id,
        videoId: newVideoDoc._id,
    });

    return res.status(202).json({
        message: "Video upload accepted.",
        videoId: newVideoDoc._id,
    });
};

const getAllVideos: RequestHandler = async (req, res) => {
    const videos = await Video.find({ userId: req.user?.id }).select([
        "-userId",
        "-__v",
    ]);

    return res.status(200).json(videos);
};

const getVideo: RequestHandler = async (req, res) => {
    const videoId = req.params.videoId;

    if (!mongooseObjectIdValidator.safeParse(videoId).success) {
        return res.status(400).json({
            message: "Invalid video ID",
            errorCode: "INVALID_VIDEO_ID",
        });
    }

    const videoDoc = await Video.findOne({
        _id: videoId,
        userId: req.user?.id,
    }).select(["-userId", "-__v"]);

    if (!videoDoc) {
        return res.status(404).json({
            message: "Video not found",
            errorCode: "VIDEO_NOT_FOUND",
        });
    }

    return res.status(200).json(videoDoc);
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
        userId: req.user?.id,
    });

    if (!videoDoc) {
        return res.status(404).json({
            message: "Video not found",
            errCode: "VIDEO_NOT_FOUND",
        });
    }

    const videoJob = await VideoJob.findOne({ videoId: videoDoc._id });

    await videoDoc.deleteOne();

    if (videoJob) {
        await videoProcessQueue.remove(videoJob.jobId);
        await videoJob.deleteOne();
    }

    await fs
        .rmdir(path.join(settings.OUTPUT_VIDEOS_DIR, videoDoc.uniqueFileName), {
            recursive: true,
        })
        .catch(() => {});

    await fs
        .unlink(
            path.join(settings.BASE_DIR, "uploads", videoDoc.uniqueFileName)
        )
        .catch(() => {});

    return res.status(204).json({});
};

const searchVideos: RequestHandler = async (req, res) => {
    const query = req.query.q as string;

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
                localField: "userId",
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
            },
        },
        {
            $unwind: {
                path: "$uploader",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $sort: { createdAt: -1 },
        },
    ]);

    return res.status(200).json(matchingVideos);
};

const watchVideo: RequestHandler = async (req, res) => {
    const videoId = req.params.videoId;

    if (!mongooseObjectIdValidator.safeParse(videoId).success) {
        return res.status(400).json({
            message: "Invalid video ID",
            errorCode: "INVALID_VIDEO_ID",
        });
    }

    const videoDoc = await Video.aggregate([
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
                localField: "userId",
                foreignField: "_id",
                as: "uploader",
                pipeline: [
                    {
                        $project: {
                            name: 1,
                            avatar: 1,
                            _id: 0,
                        },
                    },
                ],
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
            },
        },
        {
            $unwind: {
                path: "$uploader",
                preserveNullAndEmptyArrays: true,
            },
        },
    ]);

    if (videoDoc.length === 0) {
        return res.status(404).json({
            message: "Video not found",
            errorCode: "VIDEO_NOT_FOUND",
        });
    }

    return res.status(200).json(videoDoc);
};

export {
    publish,
    getVideo,
    getAllVideos,
    deleteVideo,
    searchVideos,
    watchVideo,
};
