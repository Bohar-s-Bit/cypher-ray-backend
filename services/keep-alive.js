import axios from "axios";
import logger from "../utils/logger.js";

// Keep services awake by pinging them every 10 minutes
const PING_INTERVAL = 5 * 60 * 1000; // 10 minutes

const servicesToKeepAlive = [
  { name: "ML Service", url: "https://cypher-ray-models.onrender.com/health" },
  { name: "Backend", url: "https://cypher-ray-backend.onrender.com/" },
  { name: "To-do", url: "https://to-do-app-ycyb.onrender.com/" },
];

export const startKeepAlive = () => {
  // Only run in production on Render
  if (process.env.NODE_ENV !== "production" || !process.env.RENDER) {
    logger.info(
      "Keep-alive service disabled (not in production or not on Render)"
    );
    return;
  }

  logger.info("🔄 Keep-alive service started - pinging every 10 minutes");

  // Ping immediately on startup
  pingServices();

  // Then ping every 10 minutes
  setInterval(() => {
    pingServices();
  }, PING_INTERVAL);
};

const pingServices = async () => {
  for (const service of servicesToKeepAlive) {
    try {
      await axios.get(service.url, { timeout: 5000 });
      logger.info(`✅ Keep-alive ping: ${service.name}`);
    } catch (error) {
      logger.warn(
        `⚠️ Keep-alive ping failed: ${service.name} - ${error.message}`
      );
    }
  }
};

export default { startKeepAlive };
