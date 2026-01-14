import multer, { type Options as MulterOptions } from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import settings from "../../settings.js";

const getMulterMiddleware = (options?: MulterOptions, storagePath?: string) => {
    return multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, storagePath ?? settings.UPLOADS_DIR);
            },
            filename: (req, file, cb) => {
                const ext = path.extname(file.originalname);
                const filename = `${randomUUID()}${ext}`;

                cb(null, filename);
            },
        }),
        ...options,
    });
};

export default getMulterMiddleware;
