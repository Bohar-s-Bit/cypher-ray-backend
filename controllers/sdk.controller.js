import AnalysisJob from "../models/analysis.job.model.js";
import { deductCreditsForSDK } from "../services/credit.service.js";
import {
  calculateFileHash,
  calculateBufferHash,
  deleteFile,
  validateBinaryFile,
} from "../utils/file.handler.js";
import { sdkLogger } from "../utils/logger.js";
import { sdkAnalysisQueue } from "../config/queue.js";
import { deleteFromCloudinary } from "../utils/cloudinaryHelper.js";
import path from "path";

/**
 * Check if binary hash already analyzed
 * GET /api/sdk/check-hash?hash=<sha256>
 */
export const checkHash = async (req, res) => {
  try {
    const { hash } = req.query;
    const userId = req.user._id;

    if (!hash || hash.length !== 64) {
      return res.status(400).json({
        success: false,
        message: "Invalid hash format. Provide SHA-256 hash (64 characters)",
        code: "INVALID_HASH",
      });
    }

    sdkLogger.info("Hash check request", {
      userId: userId.toString(),
      hash,
    });

    // Find completed analysis with this hash for this user
    const existingJob = await AnalysisJob.findOne({
      userId,
      fileHash: hash,
      status: "completed",
    }).sort({ completedAt: -1 });

    if (existingJob) {
      sdkLogger.info("Hash found in cache", {
        userId: userId.toString(),
        hash,
        jobId: existingJob._id.toString(),
      });

      return res.json({
        success: true,
        cached: true,
        job: {
          id: existingJob._id,
          filename: existingJob.filename,
          status: existingJob.status,
          completedAt: existingJob.completedAt,
          results: existingJob.results,
        },
      });
    }

    return res.json({
      success: true,
      cached: false,
      message: "Hash not found in cache - new analysis required",
    });
  } catch (error) {
    sdkLogger.error("Check hash error", {
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      message: "Failed to check hash",
      code: "CHECK_HASH_ERROR",
    });
  }
};

/**
 * Analyze single binary file
 * POST /api/sdk/analyze
 */
export const analyzeSingle = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
        code: "MISSING_FILE",
      });
    }

    const userId = req.user._id;
    const apiKeyId = req.apiKey._id;
    const file = req.file;

    sdkLogger.info("Single analysis request", {
      userId: userId.toString(),
      filename: file.originalname,
      size: file.size,
      cloudinaryUrl: file.path,
      cloudinaryPublicId: file.filename,
    });

    // For Cloudinary files, we need to use a different approach for hash
    // Use the Cloudinary etag or calculate from metadata
    const fileHash = file.etag || `cloudinary-${file.filename}`;

    // Check if already analyzed (deduplication)
    const existingJob = await AnalysisJob.findOne({
      userId,
      fileHash,
      status: "completed",
    }).sort({ completedAt: -1 });

    if (existingJob) {
      // Delete uploaded file from Cloudinary (not needed - duplicate)
      await deleteFromCloudinary(file.filename);

      sdkLogger.info("Returning cached analysis result", {
        userId: userId.toString(),
        hash: fileHash,
        jobId: existingJob._id.toString(),
      });

      return res.json({
        success: true,
        cached: true,
        creditsCharged: 0,
        job: {
          id: existingJob._id,
          filename: existingJob.filename,
          fileHash,
          status: existingJob.status,
          results: existingJob.results,
          startedAt: existingJob.startedAt,
          completedAt: existingJob.completedAt,
        },
      });
    }

    // Determine tier and priority
    const userTier = req.user.tier || "tier2";
    const priorityMap = { tier1: 1, tier2: 2 };
    const priority = priorityMap[userTier] || 2;

    // Create analysis job with Cloudinary data
    const job = await AnalysisJob.create({
      userId,
      apiKeyId,
      fileHash,
      filename: file.originalname,
      cloudinaryUrl: file.path, // Cloudinary returns secure_url in file.path
      cloudinaryPublicId: file.filename, // Cloudinary returns public_id in file.filename
      fileSize: file.size,
      status: "queued",
      tier: userTier,
      priority,
      creditsDeducted: 0, // Will be calculated and deducted after analysis completes
      metadata: {
        sourceIp: req.ip,
        userAgent: req.get("user-agent"),
        sdkVersion: req.get("x-sdk-version"),
        ciPlatform: req.get("x-ci-platform"),
      },
    });

    // NOTE: Credits are NOT deducted here
    // They will be calculated and deducted after analysis completes
    // based on file size + processing time

    // Add to queue with Cloudinary data
    await sdkAnalysisQueue.add(
      userTier, // processor name
      {
        jobId: job._id.toString(),
        userId: userId.toString(),
        cloudinaryUrl: file.path,
        cloudinaryPublicId: file.filename,
        fileHash,
        filename: file.originalname,
        fileSize: file.size, // Pass file size for credit calculation
        tier: userTier,
        apiKeyId: apiKeyId?.toString(),
        source: "sdk", // Identify source for correct transaction description
      },
      {
        priority,
        jobId: job._id.toString(),
      }
    );

    sdkLogger.info("Analysis job queued", {
      userId: userId.toString(),
      jobId: job._id.toString(),
      filename: file.originalname,
      fileSize: file.size,
      tier: userTier,
      priority,
      note: "Credits will be deducted after analysis completes",
    });

    return res.status(202).json({
      success: true,
      message: "Analysis job queued successfully",
      cached: false,
      job: {
        id: job._id,
        filename: job.filename,
        fileHash,
        status: job.status,
        tier: job.tier,
        queuedAt: job.queuedAt,
        estimatedTime: getEstimatedTime(userTier),
      },
      polling: {
        url: `/api/sdk/results/${job._id}`,
        interval: 5000, // Poll every 5 seconds
      },
    });
  } catch (error) {
    // Clean up uploaded file from Cloudinary on error
    if (req.file?.filename) {
      await deleteFromCloudinary(req.file.filename);
    }

    sdkLogger.error("Analyze single error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?._id?.toString(),
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to analyze file",
      code: "ANALYSIS_ERROR",
    });
  }
};

/**
 * Analyze multiple binary files (batch)
 * POST /api/sdk/analyze/batch
 */
export const analyzeBatch = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
        code: "MISSING_FILES",
      });
    }

    if (req.files.length > 50) {
      // Clean up files from Cloudinary
      for (const file of req.files) {
        await deleteFromCloudinary(file.filename);
      }

      return res.status(400).json({
        success: false,
        message: "Maximum 50 files allowed per batch",
        code: "TOO_MANY_FILES",
      });
    }

    const userId = req.user._id;
    const apiKeyId = req.apiKey._id;
    const files = req.files;

    sdkLogger.info("Batch analysis request", {
      userId: userId.toString(),
      fileCount: files.length,
    });

    const results = [];
    const userTier = req.user.tier || "tier2";
    const priorityMap = { tier1: 1, tier2: 2 };
    const priority = priorityMap[userTier] || 2;

    // Process each file
    for (const file of files) {
      try {
        // For Cloudinary files, use etag or public_id as hash
        const fileHash = file.etag || `cloudinary-${file.filename}`;

        // Check for existing analysis
        const existingJob = await AnalysisJob.findOne({
          userId,
          fileHash,
          status: "completed",
        }).sort({ completedAt: -1 });

        if (existingJob) {
          // Cached - no credit charge, delete from Cloudinary
          await deleteFromCloudinary(file.filename);

          results.push({
            filename: file.originalname,
            cached: true,
            creditsCharged: 0,
            job: {
              id: existingJob._id,
              fileHash,
              status: existingJob.status,
              results: existingJob.results,
            },
          });

          continue;
        }

        // Create job with Cloudinary data
        const job = await AnalysisJob.create({
          userId,
          apiKeyId,
          fileHash,
          filename: file.originalname,
          cloudinaryUrl: file.path,
          cloudinaryPublicId: file.filename,
          fileSize: file.size,
          status: "queued",
          tier: userTier,
          priority,
          creditsDeducted: 0, // Will be calculated and deducted after analysis completes
          metadata: {
            sourceIp: req.ip,
            userAgent: req.get("user-agent"),
            sdkVersion: req.get("x-sdk-version"),
            ciPlatform: req.get("x-ci-platform"),
          },
        });

        // NOTE: Credits are NOT deducted here
        // They will be calculated and deducted after analysis completes
        // based on file size + processing time

        // Add to queue with Cloudinary data and file size for credit calculation
        await sdkAnalysisQueue.add(
          userTier,
          {
            jobId: job._id.toString(),
            userId: userId.toString(),
            cloudinaryUrl: file.path,
            cloudinaryPublicId: file.filename,
            fileHash,
            filename: file.originalname,
            fileSize: file.size, // Pass file size for dynamic credit calculation
            tier: userTier,
            apiKeyId: apiKeyId?.toString(),
            source: "sdk", // Identify source for correct transaction description
          },
          {
            priority,
            jobId: job._id.toString(),
          }
        );

        results.push({
          filename: file.originalname,
          cached: false,
          note: "Credits will be calculated after analysis completes",
          job: {
            id: job._id,
            fileHash,
            status: job.status,
            tier: job.tier,
            queuedAt: job.queuedAt,
          },
        });
      } catch (fileError) {
        await deleteFromCloudinary(file.filename);
        results.push({
          filename: file.originalname,
          error: fileError.message,
          success: false,
        });
      }
    }

    sdkLogger.info("Batch analysis queued", {
      userId: userId.toString(),
      totalFiles: files.length,
      note: "Credits will be calculated and deducted after each file completes analysis",
    });

    return res.status(202).json({
      success: true,
      message: `${files.length} files processed`,
      totalFiles: files.length,
      note: "Credits will be calculated and deducted after analysis completes based on file size and processing time",
      results,
      polling: {
        url: "/api/sdk/results/:jobId",
        interval: 5000,
      },
    });
  } catch (error) {
    // Clean up all uploaded files
    if (req.files) {
      for (const file of req.files) {
        await deleteFile(file.path);
      }
    }

    sdkLogger.error("Batch analysis error", {
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      message: error.message || "Batch analysis failed",
      code: "BATCH_ERROR",
    });
  }
};

/**
 * Get analysis results
 * GET /api/sdk/results/:jobId
 */
export const getResults = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user._id;

    const job = await AnalysisJob.findOne({
      _id: jobId,
      userId, // Ensure user owns this job
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
        code: "JOB_NOT_FOUND",
      });
    }

    const response = {
      success: true,
      job: {
        id: job._id,
        filename: job.filename,
        fileHash: job.fileHash,
        status: job.status,
        progress: job.progress,
        tier: job.tier,
        queuedAt: job.queuedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        processingTime: job.getProcessingTime(),
      },
    };

    if (job.status === "completed") {
      response.job.results = job.results;
    } else if (job.status === "failed") {
      response.job.error = job.error;
    } else if (job.status === "processing") {
      response.estimatedTime = Math.max(30 - job.getProcessingTime(), 5); // Rough estimate
    }

    return res.json(response);
  } catch (error) {
    sdkLogger.error("Get results error", {
      error: error.message,
      jobId: req.params.jobId,
    });

    return res.status(500).json({
      success: false,
      message: "Failed to get results",
      code: "RESULTS_ERROR",
    });
  }
};

/**
 * Get credit information
 * GET /api/sdk/credits
 */
export const getCredits = async (req, res) => {
  try {
    const user = req.user;

    return res.json({
      success: true,
      credits: {
        total: user.credits.total,
        used: user.credits.used,
        remaining: user.credits.remaining,
        percentage:
          user.credits.total > 0
            ? ((user.credits.remaining / user.credits.total) * 100).toFixed(2)
            : 0,
      },
      tier: {
        name: user.tier,
        ...user.tierInfo,
      },
    });
  } catch (error) {
    sdkLogger.error("Get credits error", {
      error: error.message,
      userId: req.user._id.toString(),
    });

    return res.status(500).json({
      success: false,
      message: "Failed to get credit information",
      code: "CREDITS_ERROR",
    });
  }
};

/**
 * Helper: Get estimated processing time based on tier
 */
function getEstimatedTime(tier) {
  const estimates = {
    tier1: "30-60 seconds",
    tier2: "1-2 minutes",
  };
  return estimates[tier] || "1-2 minutes";
}

export default {
  checkHash,
  analyzeSingle,
  analyzeBatch,
  getResults,
  getCredits,
};
