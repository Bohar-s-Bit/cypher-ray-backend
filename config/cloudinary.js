import { v2 as cloudinary } from "cloudinary";
import { queueLogger } from "../utils/logger.js";

/**
 * Cloudinary Configuration
 * Optimized for FREE tier (10GB storage, 25 credits/month)
 */

// Parse Cloudinary URL from env
const cloudinaryUrl = process.env.CLOUDINARY_URL;

if (!cloudinaryUrl) {
  throw new Error("CLOUDINARY_URL environment variable is required");
}

// Initialize Cloudinary
cloudinary.config({
  cloudinary_url: cloudinaryUrl,
  secure: true, // Always use HTTPS
  timeout: 120000, // 2 minutes timeout
});

// Free tier settings
export const CLOUDINARY_CONFIG = {
  // Folder structure: cypherray/binaries/{userId}/{timestamp}-{filename}
  baseFolder: "cypherray/binaries",

  // Resource type for binary files
  resourceType: "raw",

  // Maximum file size (80MB to stay within free tier limits)
  maxFileSize: 80 * 1024 * 1024, // 80MB

  // Signed URL expiration (1 hour for security)
  signedUrlExpiration: 60 * 60, // 1 hour in seconds

  // Upload options optimized for free tier
  uploadOptions: {
    resource_type: "raw",
    folder: "cypherray/binaries", // Base folder
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    // Access control
    type: "private", // Private files (requires signed URLs)
    access_mode: "authenticated",
  },

  // Concurrent upload limit (conservative for free tier)
  maxConcurrentUploads: 3,

  // Download timeout (30 seconds)
  downloadTimeout: 30000,

  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000, // 1 second base delay
};

/**
 * Generate unique public ID for upload
 * Format: {userId}/{timestamp}-{randomHash}
 */
export const generatePublicId = (userId, filename) => {
  const timestamp = Date.now();
  const randomHash = Math.random().toString(36).substring(2, 15);
  const sanitizedFilename = filename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .substring(0, 50);

  return `${userId}/${timestamp}-${randomHash}-${sanitizedFilename}`;
};

/**
 * Generate signed URL for secure file access
 * URL expires after 1 hour
 */
export const generateSignedUrl = (publicId) => {
  try {
    const signedUrl = cloudinary.url(publicId, {
      resource_type: "raw",
      type: "private",
      sign_url: true,
      secure: true,
      expires_at:
        Math.floor(Date.now() / 1000) + CLOUDINARY_CONFIG.signedUrlExpiration,
    });

    queueLogger.info("Generated signed URL", {
      publicId,
      expiresIn: `${CLOUDINARY_CONFIG.signedUrlExpiration}s`,
    });

    return signedUrl;
  } catch (error) {
    queueLogger.error("Failed to generate signed URL", {
      publicId,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Check Cloudinary connection and quota
 */
export const checkCloudinaryHealth = async () => {
  try {
    // Test API connection by fetching usage stats
    const result = await cloudinary.api.usage();

    const usagePercent = (result.credits.used_percent || 0).toFixed(2);
    const storageUsed = (
      result.storage.used / (1024 * 1024 * 1024) || 0
    ).toFixed(2); // GB

    queueLogger.info("Cloudinary health check", {
      status: "healthy",
      creditsUsedPercent: usagePercent,
      storageUsedGB: storageUsed,
      planLimit: result.plan,
    });

    // Warn if approaching limits (80% threshold)
    if (result.credits.used_percent > 80) {
      queueLogger.warn("Cloudinary quota warning", {
        usedPercent: usagePercent,
        message: "Approaching monthly credit limit",
      });
    }

    return {
      healthy: true,
      usage: {
        creditsUsedPercent: usagePercent,
        storageUsedGB: storageUsed,
        plan: result.plan,
      },
    };
  } catch (error) {
    queueLogger.error("Cloudinary health check failed", {
      error: error.message,
      stack: error.stack,
    });

    return {
      healthy: false,
      error: error.message,
    };
  }
};

export default cloudinary;
