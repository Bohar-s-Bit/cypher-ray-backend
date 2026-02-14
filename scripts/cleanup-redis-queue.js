/**
 * Utility script to clean up stale jobs from Redis queue
 * Run this when you have "Job not found in database" errors
 *
 * Usage: node scripts/cleanup-redis-queue.js
 */

import { sdkAnalysisQueue } from "../config/queue.js";
import AnalysisJob from "../models/analysis.job.model.js";
import mongoose from "mongoose";
import "dotenv/config";

async function cleanupStaleJobs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Get all jobs from Redis queue (active, waiting, failed)
    const [activeJobs, waitingJobs, failedJobs] = await Promise.all([
      sdkAnalysisQueue.getActive(),
      sdkAnalysisQueue.getWaiting(),
      sdkAnalysisQueue.getFailed(),
    ]);

    const allRedisJobs = [...activeJobs, ...waitingJobs, ...failedJobs];
    console.log(`\n📊 Found ${allRedisJobs.length} jobs in Redis queue`);

    let removedCount = 0;
    let validCount = 0;

    for (const redisJob of allRedisJobs) {
      const jobId = redisJob.data.jobId;

      // Check if job exists in MongoDB
      const dbJob = await AnalysisJob.findById(jobId);

      if (!dbJob) {
        console.log(`❌ Removing stale job: ${jobId} (not found in database)`);
        await redisJob.remove();
        removedCount++;
      } else {
        validCount++;
      }
    }

    console.log(`\n✅ Cleanup complete:`);
    console.log(`   - Valid jobs: ${validCount}`);
    console.log(`   - Removed stale jobs: ${removedCount}`);

    // Close connections
    await sdkAnalysisQueue.close();
    await mongoose.connection.close();

    process.exit(0);
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  }
}

cleanupStaleJobs();
