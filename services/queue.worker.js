import { sdkAnalysisQueue } from "../config/queue.js";
import AnalysisJob from "../models/analysis.job.model.js";
import analysisService from "../services/analysis.service.js";
import {
  deductCreditsForSDK,
  refundCreditsForSDK,
} from "../services/credit.service.js";
import {
  calculateDynamicCredits,
  getSizeTier,
  getTimeTier,
  formatCreditBreakdown,
} from "./credit.calculator.js";
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
    fileSize,
    tier,
    apiKeyId,
    source = "sdk", // Default to SDK if not specified
  } = job.data;

  queueLogger.info("Processing analysis job", {
    jobId,
    userId,
    filename,
    fileSize,
    tier,
    cloudinaryPublicId,
    source,
  });

  let analysisJob = null;
  let tempFilePath = null;
  const analysisStartTime = Date.now();

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

    // Calculate processing time
    const analysisEndTime = Date.now();
    const processingTimeSeconds = Math.round(
      (analysisEndTime - analysisStartTime) / 1000
    );

    // Calculate dynamic credits based on size + time
    const creditCalculation = calculateDynamicCredits(
      fileSize,
      processingTimeSeconds
    );
    const creditsToDeduct = creditCalculation.total;

    // Log detailed credit calculation breakdown (internal)
    queueLogger.info("💰 Credit Calculation Breakdown", {
      jobId,
      filename,
      fileSize: `${(fileSize / (1024 * 1024)).toFixed(2)} MB`,
      processingTime: `${processingTimeSeconds}s`,
      sizeTier: getSizeTier(fileSize),
      timeTier: getTimeTier(processingTimeSeconds),
      baseCredits: creditCalculation.breakdown.baseCredits,
      timeCredits: creditCalculation.breakdown.timeCredits,
      complexityCredits: creditCalculation.breakdown.complexityCredits,
      totalCredits: creditsToDeduct,
      formula: `${creditCalculation.breakdown.baseCredits} (size) + ${creditCalculation.breakdown.timeCredits} (time) = ${creditsToDeduct} total`,
    });

    // Update job with credit breakdown
    analysisJob.processingTimeSeconds = processingTimeSeconds;
    analysisJob.creditsDeducted = creditsToDeduct;
    analysisJob.creditBreakdown = {
      baseCredits: creditCalculation.breakdown.baseCredits,
      timeCredits: creditCalculation.breakdown.timeCredits,
      complexityCredits: creditCalculation.breakdown.complexityCredits,
      sizeTier: getSizeTier(fileSize),
      timeTier: getTimeTier(processingTimeSeconds),
      totalCalculated: creditsToDeduct,
    };

    await analysisJob.save();

    // Deduct credits AFTER successful analysis
    const analysisSource = source === "user-dashboard" ? "Dashboard" : "SDK";
    const description = `${analysisSource} Binary Analysis`;

    queueLogger.info("Attempting to deduct credits", {
      jobId,
      userId,
      amount: creditsToDeduct,
      apiKeyId,
      source: analysisSource,
    });

    try {
      await deductCreditsForSDK(
        userId,
        creditsToDeduct,
        jobId,
        apiKeyId,
        description
      );

      queueLogger.info("✅ Credits deducted after successful analysis", {
        jobId,
        userId,
        creditsDeducted: creditsToDeduct,
        breakdown: formatCreditBreakdown(creditCalculation),
        processingTime: `${processingTimeSeconds}s`,
        fileSize: `${(fileSize / (1024 * 1024)).toFixed(2)} MB`,
      });
    } catch (creditError) {
      queueLogger.error("❌ Failed to deduct credits", {
        jobId,
        userId,
        amount: creditsToDeduct,
        error: creditError.message,
        stack: creditError.stack,
      });
      // Don't fail the job, but log the error
      // The analysis is complete, credit deduction failure is a separate issue
    }

    // Mark as completed
    await analysisJob.updateStatus("completed");
    await job.progress(100);

    // Emit completion event
    emitJobEvent(userId, jobId, "job:completed", {
      status: "completed",
      results,
      creditsCharged: creditsToDeduct,
    });

    queueLogger.info("Job completed successfully", {
      jobId,
      filename,
      processingTime: `${processingTimeSeconds}s`,
      creditsCharged: creditsToDeduct,
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
      creditsCharged: creditsToDeduct,
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

    // NO credits to refund since we didn't deduct any upfront
    queueLogger.info("No credits refunded (none were deducted upfront)", {
      jobId,
      userId,
      reason: "Credits are only deducted after successful analysis",
    });

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
