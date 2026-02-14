/**
 * Full reset script - clears everything EXCEPT user accounts
 *
 * What it clears:
 *   - MongoDB: AnalysisJob, ApiKey, CreditTransaction, Payment, OTP collections
 *   - Redis: ALL keys (queue data, cache, Bull job state)
 *   - Bull queue: all active, waiting, delayed, failed, completed jobs
 *
 * What it keeps:
 *   - User collection (untouched)
 *
 * Usage: node scripts/nuke-reset.js
 */

import mongoose from "mongoose";
import Redis from "ioredis";
import { sdkAnalysisQueue } from "../config/queue.js";
import "dotenv/config";

async function nukeReset() {
  console.log("\n===========================================");
  console.log("   CYPHER-RAY FULL RESET (keeps users)");
  console.log("===========================================\n");

  let redisClient;

  try {
    // ── 1. Connect to MongoDB ──
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;

    // ── 2. List all collections ──
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);
    console.log(`\n📦 Collections found: ${collectionNames.join(", ")}`);

    // ── 3. Drop everything except users ──
    const protectedCollections = ["users"];
    const toDrop = collectionNames.filter(
      (name) => !protectedCollections.includes(name)
    );

    console.log(`\n🗑️  Dropping collections: ${toDrop.join(", ")}`);
    console.log(`🔒 Keeping: ${protectedCollections.join(", ")}\n`);

    for (const name of toDrop) {
      try {
        await db.dropCollection(name);
        console.log(`   ✅ Dropped: ${name}`);
      } catch (err) {
        // Collection might not exist, that's fine
        console.log(`   ⚠️  ${name}: ${err.message}`);
      }
    }

    // ── 4. Clean Bull queue (all job states) ──
    console.log("\n🔄 Cleaning Bull queue...");
    try {
      // Pause the queue first to stop processing
      await sdkAnalysisQueue.pause(true);
      console.log("   ⏸️  Queue paused");

      const [active, waiting, delayed, failed, completed] = await Promise.all([
        sdkAnalysisQueue.getActive(),
        sdkAnalysisQueue.getWaiting(),
        sdkAnalysisQueue.getDelayed(),
        sdkAnalysisQueue.getFailed(),
        sdkAnalysisQueue.getCompleted(),
      ]);

      const total =
        active.length +
        waiting.length +
        delayed.length +
        failed.length +
        completed.length;
      console.log(
        `   📊 Jobs in queue: ${total} (active: ${active.length}, waiting: ${waiting.length}, delayed: ${delayed.length}, failed: ${failed.length}, completed: ${completed.length})`
      );

      // Remove all jobs
      const allJobs = [...active, ...waiting, ...delayed, ...failed, ...completed];
      for (const job of allJobs) {
        try {
          await job.remove();
        } catch {
          // Job might already be gone
        }
      }

      // Also use Bull's built-in clean methods
      await sdkAnalysisQueue.clean(0, "active");
      await sdkAnalysisQueue.clean(0, "wait");
      await sdkAnalysisQueue.clean(0, "delayed");
      await sdkAnalysisQueue.clean(0, "failed");
      await sdkAnalysisQueue.clean(0, "completed");

      // Empty the queue entirely
      await sdkAnalysisQueue.empty();

      console.log(`   ✅ Removed ${total} jobs from queue`);

      await sdkAnalysisQueue.close();
      console.log("   ✅ Queue closed");
    } catch (err) {
      console.log(`   ⚠️  Queue cleanup: ${err.message}`);
    }

    // ── 5. Flush all Redis data ──
    console.log("\n🔄 Flushing Redis...");
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB) || 0,
      };

      if (process.env.REDIS_URL) {
        redisClient = new Redis(process.env.REDIS_URL, {
          tls: process.env.REDIS_URL.startsWith("rediss://")
            ? { rejectUnauthorized: false }
            : undefined,
        });
      } else {
        redisClient = new Redis(redisConfig);
      }

      // Wait for connection
      await new Promise((resolve, reject) => {
        redisClient.on("ready", resolve);
        redisClient.on("error", reject);
        setTimeout(() => reject(new Error("Redis connection timeout")), 5000);
      });

      const keyCount = await redisClient.dbsize();
      await redisClient.flushdb();
      console.log(`   ✅ Flushed ${keyCount} Redis keys`);

      redisClient.disconnect();
    } catch (err) {
      console.log(`   ⚠️  Redis flush: ${err.message}`);
      if (redisClient) redisClient.disconnect();
    }

    // ── 6. Verify users are intact ──
    const userCount = await db.collection("users").countDocuments();
    console.log(`\n🔒 Users intact: ${userCount} user(s) preserved`);

    // ── Done ──
    console.log("\n===========================================");
    console.log("   RESET COMPLETE");
    console.log("===========================================");
    console.log("   - All analysis jobs: CLEARED");
    console.log("   - All API keys: CLEARED");
    console.log("   - All credit transactions: CLEARED");
    console.log("   - All payments: CLEARED");
    console.log("   - All OTPs: CLEARED");
    console.log("   - Redis cache & queue: FLUSHED");
    console.log(`   - Users: KEPT (${userCount})`);
    console.log("===========================================\n");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Reset failed:", error);
    if (redisClient) redisClient.disconnect();
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

nukeReset();
