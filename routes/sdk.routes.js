import express from "express";
import {
  checkHash,
  analyzeSingle,
  analyzeBatch,
  getResults,
  getCredits,
} from "../controllers/sdk.controller.js";
import { apiKeyAuth, requirePermission } from "../middleware/sdk.auth.js";
import { creditCheck, lowCreditWarning } from "../middleware/sdk.credit.js";
import { uploadSingle, uploadBatch } from "../utils/file.handler.js";

const router = express.Router();

// Apply API key authentication to all SDK routes
router.use(apiKeyAuth);

// Rate limiting - DISABLED for troubleshooting
// TODO: Re-enable after fixing issues

// Apply low credit warning
router.use(lowCreditWarning);

/**
 * @route   GET /api/sdk/check-hash
 * @desc    Check if binary hash already analyzed (deduplication)
 * @access  Private (API Key required)
 */
router.get("/check-hash", requirePermission("sdk:check-hash"), checkHash);

/**
 * @route   POST /api/sdk/analyze
 * @desc    Analyze single binary file
 * @access  Private (API Key + Credits required)
 */
router.post(
  "/analyze",
  requirePermission("sdk:analyze"),
  uploadSingle, // Handle file upload
  creditCheck(), // Check minimum credits (5+), actual cost calculated after analysis
  analyzeSingle
);

/**
 * @route   POST /api/sdk/analyze/batch
 * @desc    Analyze multiple binary files
 * @access  Private (API Key + Credits required)
 */
router.post(
  "/analyze/batch",
  requirePermission("sdk:batch"),
  uploadBatch, // Handle multiple files
  creditCheck(), // Credits calculated based on files
  analyzeBatch
);

/**
 * @route   GET /api/sdk/results/:jobId
 * @desc    Get analysis results for a job
 * @access  Private (API Key required)
 */
router.get("/results/:jobId", requirePermission("sdk:results"), getResults);

/**
 * @route   GET /api/sdk/credits
 * @desc    Get user credit information
 * @access  Private (API Key required)
 */
router.get("/credits", requirePermission("sdk:credits"), getCredits);

// Error handler for multer errors
router.use((error, req, res, next) => {
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File too large",
      code: "FILE_TOO_LARGE",
      details: {
        maxSize: process.env.MAX_FILE_SIZE || "100MB",
      },
    });
  }

  if (error.message?.includes("Invalid file type")) {
    return res.status(400).json({
      success: false,
      message: error.message,
      code: "INVALID_FILE_TYPE",
    });
  }

  next(error);
});

export default router;
