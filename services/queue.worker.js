import { sdkAnalysisQueue } from "../config/queue.js";
import AnalysisJob from "../models/analysis.job.model.js";
import analysisService from "../services/analysis.service.js";
import { refundCreditsForSDK } from "../services/credit.service.js";
import { deleteFile } from "../utils/file.handler.js";
import {
  downloadToTempFile,
  deleteTempFile,
  deleteFromCloudinary,
} from "../utils/cloudinaryHelper.js";
import { queueLogger } from "../utils/logger.js";
import { io } from "../server.js";

/**
 * Queue Worker Service
 * Processes SDK analysis jobs from Bull queue
 */

// Tier-based concurrency
const tierConcurrency = {
  tier1: 10,
  tier2: 5,
};

/**
 * Process analysis job
 */
async function processAnalysisJob(job) {
  const {
    jobId,
    userId,
    cloudinaryUrl,
    cloudinaryPublicId,
    fileHash,
    filename,
    tier,
  } = job.data;

  queueLogger.info("Processing analysis job", {
    jobId,
    userId,
    filename,
    tier,
    cloudinaryPublicId,
  });

  let analysisJob = null;
  let tempFilePath = null;

  try {
    // Get job from database
    analysisJob = await AnalysisJob.findById(jobId);
    if (!analysisJob) {
      throw new Error("Job not found in database");
    }

    // Update status to processing
    await analysisJob.updateStatus("processing");

    // Emit socket event
    emitJobEvent(userId, jobId, "job:processing", {
      status: "processing",
      progress: 10,
    });

    // Update progress: 20% - Downloading from Cloudinary
    await analysisJob.updateProgress(20);
    await job.progress(20);

    queueLogger.info("Downloading file from Cloudinary", {
      jobId,
      cloudinaryPublicId,
    });

    // Download file from Cloudinary to temp location
    tempFilePath = await downloadToTempFile(cloudinaryPublicId, filename);

    queueLogger.info("File downloaded successfully", {
      jobId,
      tempFilePath,
    });

    // Update progress: 40% - Starting analysis
    await analysisJob.updateProgress(40);
    await job.progress(40);

    // Call ML service for analysis using temp file
    queueLogger.info("Calling ML service", { jobId, filename });
    const results = await analysisService.analyzeBinary(tempFilePath, filename);

    // Update progress: 75% - Analysis complete
    await analysisJob.updateProgress(75);
    await job.progress(75);
    emitJobEvent(userId, jobId, "job:progress", { progress: 75 });

    // Save results
    analysisJob.results = results;
    await analysisJob.updateProgress(90);
    await job.progress(90);

    // Mark as completed
    await analysisJob.updateStatus("completed");
    await job.progress(100);

    // Emit completion event
    emitJobEvent(userId, jobId, "job:completed", {
      status: "completed",
      results,
    });

    queueLogger.info("Job completed successfully", {
      jobId,
      filename,
      processingTime: analysisJob.getProcessingTime(),
    });

    // Clean up temp file
    if (tempFilePath) {
      await deleteTempFile(tempFilePath);
    }

    // Note: We keep the file on Cloudinary for 24 hours
    // Cleanup job will delete it later

    return {
      success: true,
      jobId,
      results,
    };
  } catch (error) {
    queueLogger.error("Job processing failed", {
      jobId,
      error: error.message,
      stack: error.stack,
    });

    // Update job status to failed
    if (analysisJob) {
      await analysisJob.updateStatus("failed", error);
    }

    // Refund credits
    try {
      if (analysisJob && analysisJob.creditsDeducted > 0) {
        await refundCreditsForSDK(
          userId,
          analysisJob.creditsDeducted,
          jobId,
          error.message
        );

        queueLogger.info("Credits refunded", {
          jobId,
          userId,
          amount: analysisJob.creditsDeducted,
        });
      }
    } catch (refundError) {
      queueLogger.error("Credit refund failed", {
        jobId,
        error: refundError.message,
      });
    }

    // Emit failure event
    emitJobEvent(userId, jobId, "job:failed", {
      status: "failed",
      error: {
        message: error.message,
        code: error.code,
      },
    });

    // Clean up temp file
    if (tempFilePath) {
      await deleteTempFile(tempFilePath);
    }

    // Delete from Cloudinary immediately on failure
    if (cloudinaryPublicId) {
      queueLogger.info("Deleting failed job file from Cloudinary", {
        jobId,
        cloudinaryPublicId,
      });
      await deleteFromCloudinary(cloudinaryPublicId);
    }

    // Re-throw error for Bull to handle retries
    throw error;
  }
}

/**
 * Emit socket event for job updates
 */
function emitJobEvent(userId, jobId, event, data) {
  try {
    // Emit to job room
    io.to(`job:${jobId}`).emit(event, {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    });

    // Emit to user room
    io.to(`user:${userId}`).emit(event, {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    queueLogger.error("Socket emit failed", {
      event,
      jobId,
      error: error.message,
    });
  }
}

/**
 * Register queue processors for each tier
 */
export function initializeQueueWorkers() {
  queueLogger.info("Initializing queue workers");

  // Register processor for each tier
  Object.keys(tierConcurrency).forEach((tier) => {
    sdkAnalysisQueue.process(tier, tierConcurrency[tier], async (job) => {
      queueLogger.info(`Processing ${tier} job`, {
        jobId: job.id,
        attempt: job.attemptsMade + 1,
      });

      return await processAnalysisJob(job);
    });

    queueLogger.info(`Registered ${tier} processor`, {
      concurrency: tierConcurrency[tier],
    });
  });

  // Event handlers
  sdkAnalysisQueue.on("completed", (job, result) => {
    queueLogger.info("Queue job completed", {
      jobId: job.id,
      tier: job.data.tier,
      duration: Date.now() - job.timestamp,
    });
  });

  sdkAnalysisQueue.on("failed", (job, err) => {
    queueLogger.error("Queue job failed", {
      jobId: job.id,
      tier: job.data.tier,
      attempt: job.attemptsMade,
      maxAttempts: job.opts.attempts,
      error: err.message,
    });
  });

  sdkAnalysisQueue.on("stalled", (job) => {
    queueLogger.warn("Queue job stalled", {
      jobId: job.id,
      tier: job.data.tier,
    });
  });

  sdkAnalysisQueue.on("progress", (job, progress) => {
    queueLogger.debug("Queue job progress", {
      jobId: job.id,
      progress,
    });
  });

  queueLogger.info("Queue workers initialized successfully");
}

// Initialize workers
initializeQueueWorkers();

export default {
  initializeQueueWorkers,
  processAnalysisJob,
};
