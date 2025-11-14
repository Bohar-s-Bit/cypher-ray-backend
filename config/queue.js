import Queue from "bull";
import redisClient from "./redis.js";
import dotenv from "dotenv";

dotenv.config();

// Queue configuration - support both URL and host-based Redis
let redisConfig;

if (process.env.REDIS_URL) {
  // URL-based connection (Upstash, Railway, etc.) with TLS support
  const url = new URL(process.env.REDIS_URL);
  redisConfig = {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password,
    tls: process.env.REDIS_URL.startsWith("rediss://")
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
    enableReadyCheck: false,
    maxRetriesPerRequest: 20,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    reconnectOnError: (err) => {
      const targetError = "READONLY";
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
  };
  console.log("✅ Using REDIS_URL for queue with TLS");
} else {
  // Host-based connection (local development)
  redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };
  console.log("⚠️  Using localhost Redis for queue");
}

const queueConfig = {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 10000, // 10 seconds
    },
    timeout: 600000, // 10 minutes
    removeOnComplete: false,
    removeOnFail: false,
  },
};

// Create SDK Analysis Queue
export const sdkAnalysisQueue = new Queue("sdk-analysis", queueConfig);

// Queue event handlers
sdkAnalysisQueue.on("error", (error) => {
  console.error("❌ Queue error:", error);
});

sdkAnalysisQueue.on("waiting", (jobId) => {
  console.log(`⏳ Job ${jobId} is waiting`);
});

sdkAnalysisQueue.on("active", (job) => {
  console.log(`🔄 Job ${job.id} started processing`);
});

sdkAnalysisQueue.on("completed", (job, result) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

sdkAnalysisQueue.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
});

sdkAnalysisQueue.on("stalled", (job) => {
  console.warn(`⚠️ Job ${job.id} stalled`);
});

// Cleanup old jobs periodically (every hour)
setInterval(async () => {
  const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
  await sdkAnalysisQueue.clean(gracePeriod, "completed");
  await sdkAnalysisQueue.clean(gracePeriod, "failed");
}, 60 * 60 * 1000);

export default {
  sdkAnalysisQueue,
  queueConfig,
};
