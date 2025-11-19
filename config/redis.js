import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// Optimized Redis configuration for production
const baseRedisOptions = {
  // Connection pooling
  maxRetriesPerRequest: null, // Bull requires null for proper retry handling
  enableReadyCheck: false, // Disable to reduce commands
  enableOfflineQueue: true,

  // Optimized retry strategy - exponential backoff
  retryStrategy: (times) => {
    if (times > 10) {
      console.error("❌ Redis connection failed after 10 retries");
      return null; // Stop retrying after 10 attempts
    }
    const delay = Math.min(times * 100, 3000); // Max 3s delay
    return delay;
  },

  // Reconnect on specific errors
  reconnectOnError: (err) => {
    const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
    return targetErrors.some((target) => err.message.includes(target));
  },

  // Lazy connect - don't connect until first command
  lazyConnect: false,

  // Keep alive
  keepAlive: 30000, // 30s keepalive

  // Command timeout
  commandTimeout: 5000, // 5s timeout for commands
};

// Support both URL-based (Upstash, Railway, Render, Aiven) and host-based (local, Redis Cloud) configs
let redisClient;

if (process.env.REDIS_URL) {
  // URL-based connection (for cloud providers)
  redisClient = new Redis(process.env.REDIS_URL, {
    ...baseRedisOptions,
    // TLS config for secure connections
    tls: process.env.REDIS_URL.startsWith("rediss://")
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  });
} else {
  // Host-based connection (for local development or Redis Cloud)
  const redisConfig = {
    ...baseRedisOptions,
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB) || 0,
  };

  redisClient = new Redis(redisConfig);
}

redisClient.on("connect", () => {
  console.log("🔴 Redis connected successfully");
});

redisClient.on("error", (err) => {
  console.error("❌ Redis connection error:", err.message);
});

redisClient.on("ready", () => {
  console.log("✅ Redis client ready");
});

export default redisClient;
