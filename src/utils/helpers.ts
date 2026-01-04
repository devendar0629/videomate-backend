import { isValidObjectId } from "mongoose";
import type { $ZodIssue } from "zod/v4/core";
import z from "zod";

const formatZodErrors = (issues: $ZodIssue[]) => {
    return issues.map((issue) => ({
        field: issue.path.join("."),
        error: issue.message,
    }));
};

const mongooseObjectIdValidator = z
    .string("Invalid ObjectId")
    .length(24, "Invalid ObjectId")
    .refine((val) => {
        return isValidObjectId(val);
    }, "Invalid ObjectId");

export { formatZodErrors, mongooseObjectIdValidator };
