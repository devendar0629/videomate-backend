import { spawn } from "child_process";

type ResolutionSettings = {
    name: string;
    width: number;
    height: number;
    bitrate: string;
    maxrate: string;
    bufsize: string;
};

const getVideoMetaData = (filePath: string): Promise<VideoMetaData> => {
    return new Promise((resolve, reject) => {
        // prettier-ignore
        const ffprobeArgs = [
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-show_format",
            filePath
        ];

        const ffprobeChildProcess = spawn("ffprobe", ffprobeArgs);

        let ffprobeStdout = "";
        let ffprobeStderr = "";

        ffprobeChildProcess.stdout.on("data", (chunk) => {
            ffprobeStdout += chunk.toString();
        });
        ffprobeChildProcess.stderr.on("data", (chunk) => {
            ffprobeStderr += chunk.toString();
        });

        ffprobeChildProcess.on("close", (code) => {
            if (code !== 0) {
                reject(
                    new Error(
                        `ffprobe failed with code=(${code}): ${ffprobeStderr}`
                    )
                );
                return;
            }

            try {
                const data = JSON.parse(ffprobeStdout);

                const videoStream = data.streams.find(
                    (s: any) => s.codec_type === "video"
                );
                const hasAudio = data.streams.some(
                    (s: any) => s.codec_type === "audio"
                );

                if (!videoStream) {
                    reject("No video stream found");
                    return;
                }

                const { width, height } = videoStream;

                // duration is a string in seconds → convert to number
                const duration = data.format?.duration
                    ? parseFloat(data.format.duration)
                    : 0;

                resolve({
                    width,
                    height,
                    hasAudio,
                    duration,
                });
            } catch (err) {
                reject(err);
            }
        });
    });
};

const buildFFmpegTranscodeArgs = (
    inputFilePath: string,
    outputPath: string,
    RESOLUTION_SETTINGS: ResolutionSettings[],
    hasAudio: boolean
): string[] => {
    const args: string[] = [];

    args.push("-i", inputFilePath);

    const resolutionNames = RESOLUTION_SETTINGS.map((res) => res.name);

    if (hasAudio) {
        const videoSplit =
            `[0:v]split=${RESOLUTION_SETTINGS.length}` +
            RESOLUTION_SETTINGS.map((_, i) => `[v${i}]`).join("") +
            "; ";

        const audioSplit =
            `[0:a]asplit=${RESOLUTION_SETTINGS.length}` +
            RESOLUTION_SETTINGS.map((_, i) => `[a${i}]`).join("") +
            " ";

        args.push("-filter_complex", `${videoSplit}${audioSplit}`);

        RESOLUTION_SETTINGS.forEach((_, index) => {
            args.push("-map", `[v${index}]`, "-map", `[a${index}]`);
        });

        args.push(
            "-x264opts",
            "keyint=48:min-keyint=48:no-scenecut",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-c:a",
            "aac",
            "-b:a",
            "128k"
        );

        RESOLUTION_SETTINGS.forEach((res, index) => {
            args.push(
                `-b:v:${index}`,
                res.bitrate,
                `-s:v:${index}`,
                `${res.width}x${res.height}`,
                `-maxrate:v:${index}`,
                res.maxrate,
                `-bufsize:v:${index}`,
                res.bufsize
            );
        });

        args.push(
            "-f",
            "hls",
            "-hls_time",
            "4",
            "-hls_playlist_type",
            "vod",
            "-hls_segment_type",
            "mpegts",
            "-master_pl_name",
            "master.m3u8"
        );

        const varStreamMap = RESOLUTION_SETTINGS.map(
            (_, i) => `v:${i},a:${i},name:${resolutionNames[i]}`
        ).join(" ");

        args.push(
            "-var_stream_map",
            varStreamMap,
            "-hls_segment_filename",
            `${outputPath}/%v/segment_%03d.ts`,
            `${outputPath}/%v/index.m3u8`
        );
    } else {
        const videoSplit =
            `[0:v]split=${RESOLUTION_SETTINGS.length}` +
            RESOLUTION_SETTINGS.map((_, i) => `[v${i}]`).join("") +
            " ";

        args.push("-filter_complex", videoSplit);

        RESOLUTION_SETTINGS.forEach((_, index) => {
            args.push("-map", `[v${index}]`);
        });

        args.push(
            "-x264opts",
            "keyint=48:min-keyint=48:no-scenecut",
            "-c:v",
            "libx264",
            "-preset",
            "medium"
        );

        RESOLUTION_SETTINGS.forEach((res, index) => {
            args.push(
                `-b:v:${index}`,
                res.bitrate,
                `-s:v:${index}`,
                `${res.width}x${res.height}`,
                `-maxrate:v:${index}`,
                res.maxrate,
                `-bufsize:v:${index}`,
                res.bufsize
            );
        });

        args.push(
            "-f",
            "hls",
            "-hls_time",
            "4",
            "-hls_playlist_type",
            "vod",
            "-hls_segment_type",
            "mpegts",
            "-master_pl_name",
            "master.m3u8"
        );

        const varStreamMap = RESOLUTION_SETTINGS.map(
            (_, i) => `v:${i},name:${resolutionNames[i]}`
        ).join(" ");

        args.push(
            "-var_stream_map",
            varStreamMap,
            "-hls_segment_filename",
            `${outputPath}/%v/segment_%03d.ts`,
            `${outputPath}/%v/index.m3u8`
        );
    }

    return args;
};

export { getVideoMetaData, buildFFmpegTranscodeArgs };
