import fs from "fs/promises";
import { spawn } from "child_process";
import { RESOLUTION_SETTINGS } from "../../settings";
import type { Processor } from "bullmq";
import Video from "../models/video.model";
import {
    buildFFmpegTranscodeArgs,
    getVideoMetaData,
} from "../utils/video/helpers";

type ResolutionName =
    | "4k"
    | "1440p"
    | "1080p"
    | "720p"
    | "480p"
    | "360p"
    | "240p"
    | "144p";

const transcodeVideoToDownscaleResolutions = async (
    inputFilePath: string,
    outputPath: string
): Promise<ResolutionName[]> => {
    return new Promise(async (resolve, reject) => {
        // Create output directory
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

const transcodeVideo: Processor = async (job) => {
    const { videoPath, outputPath, videoDocId } = job.data;

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

        const availableResolutions = await transcodeVideoToDownscaleResolutions(
            videoPath,
            outputPath
        );

        videoDoc.availableResolutions = availableResolutions;

        videoDoc.status = "finished";
        await videoDoc.save();

        await fs.unlink(videoPath);

        console.log(
            `Job ${job.id} :: Transcoding completed for video ID: ${videoDocId}`
        );
    } catch (error) {
        await Video.findByIdAndUpdate(videoDocId, { status: "error" });

        throw error;
    }
};

export { transcodeVideo };
