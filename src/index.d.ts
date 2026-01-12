interface VideoMetaData {
    width: number;
    height: number;
    hasAudio: boolean;
    duration: number;
}

type ResolutionSettings = {
    name: string;
    width: number;
    height: number;
    bitrate: string;
    maxrate: string;
    bufsize: string;
};

type ResolutionName =
    | "4k"
    | "1440p"
    | "1080p"
    | "720p"
    | "480p"
    | "360p"
    | "240p"
    | "144p";
