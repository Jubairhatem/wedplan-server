const app = require("./app");
const env = require("./config/env");
const { connectDB } = require("./config/db");

const PORT = env.PORT;

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`✅ WedPlan server is running on port ${PORT}`);
      console.log(`🌐 Client URL: ${env.CLIENT_URL}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

start();
