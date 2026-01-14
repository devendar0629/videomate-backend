import mongoose from "mongoose";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import settings from "../../settings.js";

interface I_UserMethods {
    checkPassword(password: string): Promise<boolean>;
    generateAccessToken(): string;
    generateRefreshToken(): string;
}

const userSchema = new mongoose.Schema(
    {
        avatar: {
            type: String,
            default: "/avatars/default.png",
            trim: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        videos: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Video",
            },
        ],
    },
    { timestamps: true }
);

userSchema.methods.checkPassword = async function (plainPassword: string) {
    return argon2.verify(this.password, plainPassword);
};
userSchema.methods.generateAccessToken = function () {
    const payload = { id: this._id, email: this.email };
    return jwt.sign(payload, settings.ACCESS_TOKEN_SECRET!);
};
userSchema.methods.generateRefreshToken = function () {
    const payload = { id: this._id, email: this.email };
    return jwt.sign(payload, settings.REFRESH_TOKEN_SECRET!);
};

userSchema.pre("save", async function (next) {
    if (this.isModified("password")) {
        this.password = await argon2.hash(this.password, {
            memoryCost: 65536, // In KB
            timeCost: 3,
            parallelism: 1,
            type: argon2.argon2id,
        });
    }

    next();
});

export type TUser = mongoose.InferSchemaType<typeof userSchema>;
const User = mongoose.model<TUser, mongoose.Model<TUser, {}, I_UserMethods>>(
    "User",
    userSchema
);

export default User;
