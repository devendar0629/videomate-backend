import type { RequestHandler } from "express";

const ping: RequestHandler = (req, res) => {
    return res.json({
        message: "PONG",
    });
};

export { ping };
