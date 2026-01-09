import type { RequestHandler } from "express";
import z from "zod";
import User from "../models/user.model";
import { formatZodErrors } from "../utils/helpers";

const _editDetailsPayloadSchema = z
    .strictObject(
        {
            name: z.string().min(1).max(100).optional(),
            avatar: z
                .custom<Express.Multer.File>()
                .refine((file) => !!file, {
                    error: "A valid image file is required",
                })
                .refine(
                    (file) => !!file && file.mimetype.startsWith("image/"),
                    {
                        error: "Uploaded file must be an image",
                    }
                )
                .refine((file) => !!file && file.size <= 2 * 1024 * 1024, {
                    error: "Image file size must not exceed 2MB",
                })
                .optional(),
        },
        "Invalid payload"
    )
    .refine(
        (data) => {
            return !!data.name || !!data.avatar;
        },
        {
            message: "At least one of 'name' or 'avatar' must be provided",
        }
    );

const editDetails: RequestHandler = async (req, res) => {
    const userId = req.user?.id;

    const bodyParseResult = _editDetailsPayloadSchema.safeParse({
        ...req.body,
        avatar: req.file,
    });

    if (!bodyParseResult.success) {
        return res.status(400).json({
            errors: formatZodErrors(bodyParseResult.error.issues),
            errorCode: "INVALID_PAYLOAD",
        });
    }

    const { name, avatar } = bodyParseResult.data;
    const updateData: { name?: string; avatar?: string } = {};

    if (name) updateData.name = name;
    if (avatar) updateData.avatar = `/avatars/${avatar.filename}`;

    await User.findByIdAndUpdate(userId, updateData, {
        new: true,
    })
        .select("name email avatar -_id")
        .lean();

    return res.status(200).json({
        message: "User details updated successfully",
    });
};

const getProfile: RequestHandler = async (req, res) => {
    const user = await User.findById(req.user?.id).select(
        "name email avatar -_id"
    );

    if (!user) {
        return res.status(404).json({
            message: "User not found",
            errorCode: "USER_NOT_FOUND",
        });
    }

    return res.status(200).json({
        message: "User profile fetched successfully",
        data: { user },
    });
};

export { editDetails, getProfile };
