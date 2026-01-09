import fs from "fs/promises";
import { spawn } from "child_process";
import { RESOLUTION_SETTINGS } from "../../settings";
import type { Processor } from "bullmq";
import Video from "../models/video.model";
import {
    buildFFmpegTranscodeArgs,
    getVideoMetaData,
} from "../utils/video/helpers";
import VideoJob from "../models/video-job.model";
import path from "path";

const generateThumbnail = async (videoFilePath: string, outputPath: string) => {
    return new Promise<void>((resolve, reject) => {
        // prettier-ignore
        const args = [
            "-ss", "00:00:00",
            "-i", videoFilePath,
            "-frames:v", "1",
            "-update", "1",
            outputPath,
        ];

        const generateThumbnailFFmpegProcess = spawn("ffmpeg", args);

        let ffmpegStderr = "";

        generateThumbnailFFmpegProcess.stderr.on("data", (chunk) => {
            ffmpegStderr += chunk.toString();
        });

        generateThumbnailFFmpegProcess.on("close", (code) => {
            if (code !== 0) {
                reject(
                    new Error(
                        `ffmpeg transcoding failed with code=(${code}): ${ffmpegStderr}`
                    )
                );
                return;
            }

            resolve();
        });
    });
};

const transcodeVideoToDownscaleResolutions = async (
    inputFilePath: string,
    outputPath: string
): Promise<ResolutionName[]> => {
    return new Promise(async (resolve, reject) => {
        await fs.mkdir(outputPath, { recursive: true }).catch((err) => {
            console.error("❌ Error creating output directory:", err);
            throw err;
        });

        try {
            const videoMetaData = await getVideoMetaData(inputFilePath);

            const downscaleResolutions = RESOLUTION_SETTINGS.filter(
                (res) =>
                    res.height <= videoMetaData.height &&
                    res.width <= videoMetaData.width
            );

            const ffmpegTranscodeArgs = buildFFmpegTranscodeArgs(
                inputFilePath,
                outputPath,
                downscaleResolutions,
                videoMetaData.hasAudio
            );

            const transcodeFFmpegProcess = spawn("ffmpeg", ffmpegTranscodeArgs);

            let ffmpegStderr = "";

            transcodeFFmpegProcess.stderr.on("data", (chunk) => {
                ffmpegStderr += chunk.toString();
            });

            transcodeFFmpegProcess.on("close", (code) => {
                if (code !== 0) {
                    reject(
                        new Error(
                            `ffmpeg transcoding failed with code=(${code}): ${ffmpegStderr}`
                        )
                    );
                    return;
                }

                resolve(
                    downscaleResolutions.map(
                        (res) => res.name
                    ) as ResolutionName[]
                );
            });
        } catch (error) {
            await fs.rmdir(outputPath, { recursive: true });
            reject(error);
        }
    });
};

const processVideo: Processor = async (job) => {
    const {
        videoPath,
        outputPath,
        videoDocId,
        oldVideoPath,
        newOriginalFileName,
    } = job.data;

    console.log(
        `Job ${job.id} :: Starting transcoding for video ID: ${videoDocId}`
    );

    try {
        // Update the video status to 'processing'
        const videoDoc = await Video.findById(videoDocId);

        if (!videoDoc) {
            throw new Error("Video document not found");
        }

        videoDoc.status = "processing";
        await videoDoc.save();

        const [availableResolutions] = await Promise.all([
            transcodeVideoToDownscaleResolutions(videoPath, outputPath),
            generateThumbnail(videoPath, `${outputPath}/thumbnail.jpg`),
        ]);

        videoDoc.availableResolutions = availableResolutions;
        videoDoc.status = "finished";
        videoDoc.uniqueFileName = path.basename(outputPath);

        if (newOriginalFileName) {
            videoDoc.originalFileName = newOriginalFileName;
        }

        await Promise.all([
            videoDoc.save(), // Save the updated video document
            fs.unlink(videoPath), // Delete the original uploaded video file
            VideoJob.findOneAndDelete({ jobId: job.id }), // Clean up the VideoJob entry
        ]);

        if (oldVideoPath) {
            await fs.rmdir(oldVideoPath, { recursive: true });
        }
    } catch (error) {
        await Video.findByIdAndUpdate(videoDocId, { status: "error" });

        throw error;
    }
};

export { processVideo };
