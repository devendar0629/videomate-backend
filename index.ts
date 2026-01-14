import server from "./src/server.js";
import settings from "./settings.js";
import { connectDB } from "./src/lib/db.js";

const SERVER_PORT = settings.SERVER_PORT;

async function startApp() {
    try {
        await connectDB();
        console.log("✅ DB connected successfully");
    } catch (err) {
        console.error("❌ DB connection failed", err);
        process.exit(1);
    }

    server.listen(SERVER_PORT, () => {
        console.log();
        console.log("✨ Server started.");
        console.log(`✨ Local: http://localhost:${SERVER_PORT}`);
        console.log();
    });
}

startApp().catch((err) => {
    console.error("❌ Fatal error during startup:", err);
    process.exit(1);
});
