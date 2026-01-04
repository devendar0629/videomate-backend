import multer, { type Options as MulterOptions } from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";

const getMulterMiddleware = (options?: MulterOptions) => {
    return multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                cb(
                    null,
                    path.join(__dirname, path.join("../", "../", "uploads"))
                );
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
