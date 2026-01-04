import server from "./src/server";
import settings from "./settings";
import { connectDB } from "./src/lib/db";

const SERVER_PORT = settings.SERVER_PORT;

await connectDB()
    .then(() => {
        console.log("✅ DB connected successfully");
    })
    .catch((err) => {
        console.log("❌ DB connection failed", err);
    });

server.listen(SERVER_PORT, async () => {
    console.log();
    console.log("Server started.");
    console.log(`Local: http://localhost:${SERVER_PORT}`);
    console.log();
});
