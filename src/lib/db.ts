import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        const db_name = process.env.DATABASE_NAME;
        const db_host = process.env.DATABASE_HOST;
        const db_port = process.env.DATABASE_PORT;
        const db_user = process.env.DATABASE_USERNAME;
        const db_pass = process.env.DATABASE_PASSWORD;

        const DATABASE_URI = `mongodb://${db_user}:${db_pass}@${db_host}:${db_port}/${db_name}?authSource=admin`;

        return await mongoose.connect(DATABASE_URI);
    } catch (error) {
        console.log("❌ Error connecting to database:", error);
        process.exit(1);
    }
};
