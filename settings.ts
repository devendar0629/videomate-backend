import path from "node:path";

// All paths relative to src directory
const SERVER_PORT = process.env.SERVER_PORT ?? 3000;

const SUPPORTED_VIDEO_FORMAT_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv"];
const MAX_VIDEO_FILE_SIZE_MEGABYTES = 500;
const MAX_VIDEO_FILE_SIZE_BYTES = MAX_VIDEO_FILE_SIZE_MEGABYTES * 1024 * 1024;
// const BASE_DIR = __dirname;
const BASE_DIR = import.meta.dirname;
const RESOLUTION_SETTINGS = [
    {
        name: "144p",
        width: 256,
        height: 144,
        bitrate: "200k",
        maxrate: "214k",
        bufsize: "300k",
    },
    {
        name: "240p",
        width: 426,
        height: 240,
        bitrate: "400k",
        maxrate: "428k",
        bufsize: "600k",
    },
    {
        name: "360p",
        width: 640,
        height: 360,
        bitrate: "800k",
        maxrate: "856k",
        bufsize: "1200k",
    },
    {
        name: "480p",
        width: 854,
        height: 480,
        bitrate: "1500k",
        maxrate: "1605k",
        bufsize: "2500k",
    },
    {
        name: "720p",
        width: 1280,
        height: 720,
        bitrate: "3000k",
        maxrate: "3210k",
        bufsize: "4500k",
    },
    {
        name: "1080p",
        width: 1920,
        height: 1080,
        bitrate: "5000k",
        maxrate: "5350k",
        bufsize: "7500k",
    },
    {
        name: "1440p",
        width: 2560,
        height: 1440,
        bitrate: "8000k",
        maxrate: "8560k",
        bufsize: "12000k",
    },
    {
        name: "4k",
        width: 3840,
        height: 2160,
        bitrate: "15000k",
        maxrate: "16000k",
        bufsize: "20000k",
    },
];

const OUTPUT_VIDEOS_DIR =
    process.env.OUTPUT_VIDEOS_DIR ?? path.join(BASE_DIR, "/data/videos");
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(BASE_DIR, "/uploads");
const AVATARS_DIR =
    process.env.AVATARS_DIR ?? path.join(BASE_DIR, "/data/avatars");

const ACCESS_TOKEN_EXP_SECS = parseInt(
    process.env.ACCESS_TOKEN_EXP_SECS ?? "900"
);
const REFRESH_TOKEN_EXP_SECS = parseInt(
    process.env.REFRESH_TOKEN_EXP_SECS ?? "604800"
);

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const settings = {
    SERVER_PORT,
    SUPPORTED_VIDEO_FORMAT_EXTENSIONS,
    MAX_VIDEO_FILE_SIZE_BYTES,
    MAX_VIDEO_FILE_SIZE_MEGABYTES,
    BASE_DIR,
    RESOLUTION_SETTINGS,
    ACCESS_TOKEN_EXP_SECS,
    REFRESH_TOKEN_EXP_SECS,
    ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET,
    OUTPUT_VIDEOS_DIR,
    UPLOADS_DIR,
    AVATARS_DIR,
};

export {
    SERVER_PORT,
    UPLOADS_DIR,
    OUTPUT_VIDEOS_DIR,
    SUPPORTED_VIDEO_FORMAT_EXTENSIONS,
    MAX_VIDEO_FILE_SIZE_BYTES,
    MAX_VIDEO_FILE_SIZE_MEGABYTES,
    BASE_DIR,
    RESOLUTION_SETTINGS,
    ACCESS_TOKEN_EXP_SECS,
    REFRESH_TOKEN_EXP_SECS,
    ACCESS_TOKEN_SECRET,
    REFRESH_TOKEN_SECRET,
    AVATARS_DIR,
};
export default settings;
