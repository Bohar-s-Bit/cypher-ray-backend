import cloudinary, {
  CLOUDINARY_CONFIG,
  generateSignedUrl,
} from "../config/cloudinary.js";
import axios from "axios";
import { queueLogger } from "./logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Upload file to Cloudinary
 * @param {String} filePath - Local file path
 * @param {String} publicId - Unique public ID
 * @param {Object} options - Additional upload options
 * @returns {Promise<Object>} Upload result with URL and public_id
 */
export const uploadToCloudinary = async (filePath, publicId, options = {}) => {
  try {
    queueLogger.info("Uploading to Cloudinary", {
      publicId,
      filePath,
    });

    const uploadOptions = {
      ...CLOUDINARY_CONFIG.uploadOptions,
      public_id: publicId,
      ...options,
    };

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);

    queueLogger.info("Cloudinary upload successful", {
      publicId: result.public_id,
      url: result.secure_url,
      bytes: result.bytes,
      format: result.format,
    });

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      bytes: result.bytes,
      format: result.format,
      resourceType: result.resource_type,
    };
  } catch (error) {
    queueLogger.error("Cloudinary upload failed", {
      publicId,
      error: error.message,
      stack: error.stack,
    });

    // Handle specific Cloudinary errors
    if (error.http_code === 420) {
      throw new Error("Cloudinary quota exceeded - please contact support");
    }

    if (error.http_code === 401) {
      throw new Error("Cloudinary authentication failed - invalid credentials");
    }

    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

/**
 * Download file from Cloudinary
 * @param {String} publicId - Cloudinary public ID
 * @param {String} url - Optional signed URL (if already generated)
 * @returns {Promise<Buffer>} File buffer
 */
export const downloadFromCloudinary = async (publicId, url = null) => {
  let downloadUrl = url;
  let retries = 0;

  while (retries < CLOUDINARY_CONFIG.maxRetries) {
    try {
      queueLogger.info("Downloading from Cloudinary", {
        publicId,
        attempt: retries + 1,
      });

      // Generate signed URL if not provided
      if (!downloadUrl) {
        downloadUrl = generateSignedUrl(publicId);
      }

      // Download with timeout
      const response = await axios.get(downloadUrl, {
        responseType: "arraybuffer",
        timeout: CLOUDINARY_CONFIG.downloadTimeout,
        maxContentLength: CLOUDINARY_CONFIG.maxFileSize,
      });

      const buffer = Buffer.from(response.data);

      queueLogger.info("Cloudinary download successful", {
        publicId,
        bytes: buffer.length,
      });

      return buffer;
    } catch (error) {
      retries++;

      queueLogger.error("Cloudinary download failed", {
        publicId,
        attempt: retries,
        error: error.message,
      });

      // If max retries reached, throw error
      if (retries >= CLOUDINARY_CONFIG.maxRetries) {
        if (error.code === "ECONNABORTED") {
          throw new Error("Download timeout - file may be too large");
        }

        if (error.response?.status === 404) {
          throw new Error("File not found on Cloudinary");
        }

        throw new Error(`Cloudinary download failed: ${error.message}`);
      }

      // Exponential backoff
      const delay = CLOUDINARY_CONFIG.retryDelay * Math.pow(2, retries - 1);
      queueLogger.info(`Retrying download in ${delay}ms`, { publicId });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

/**
 * Delete file from Cloudinary
 * @param {String} publicId - Cloudinary public ID
 * @returns {Promise<Boolean>} Success status
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    queueLogger.info("Deleting from Cloudinary", { publicId });

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: CLOUDINARY_CONFIG.resourceType,
      invalidate: true, // Invalidate CDN cache
    });

    if (result.result === "ok" || result.result === "not found") {
      queueLogger.info("Cloudinary deletion successful", {
        publicId,
        result: result.result,
      });
      return true;
    }

    queueLogger.warn("Cloudinary deletion returned unexpected result", {
      publicId,
      result: result.result,
    });

    return false;
  } catch (error) {
    queueLogger.error("Cloudinary deletion failed", {
      publicId,
      error: error.message,
    });

    // Don't throw error for deletion failures - just log
    // File might already be deleted or doesn't exist
    return false;
  }
};

/**
 * Download from Cloudinary and save to temp file
 * Used for ML service processing
 * @param {String} publicId - Cloudinary public ID
 * @param {String} filename - Original filename
 * @returns {Promise<String>} Temporary file path
 */
export const downloadToTempFile = async (publicId, filename) => {
  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Download buffer from Cloudinary
    const buffer = await downloadFromCloudinary(publicId);

    // Generate unique temp filename
    const timestamp = Date.now();
    const tempFilename = `${timestamp}-${filename}`;
    const tempPath = path.join(tempDir, tempFilename);

    // Write buffer to temp file
    await fs.promises.writeFile(tempPath, buffer);

    queueLogger.info("File downloaded to temp location", {
      publicId,
      tempPath,
      bytes: buffer.length,
    });

    return tempPath;
  } catch (error) {
    queueLogger.error("Failed to download to temp file", {
      publicId,
      filename,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Delete temp file
 * @param {String} filePath - Temp file path
 */
export const deleteTempFile = async (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      queueLogger.info("Temp file deleted", { filePath });
    }
  } catch (error) {
    queueLogger.error("Failed to delete temp file", {
      filePath,
      error: error.message,
    });
    // Don't throw - temp file cleanup is not critical
  }
};

/**
 * Batch upload files to Cloudinary with concurrency limit
 * @param {Array} files - Array of {filePath, publicId} objects
 * @returns {Promise<Array>} Array of upload results
 */
export const batchUploadToCloudinary = async (files) => {
  const results = [];
  const concurrency = CLOUDINARY_CONFIG.maxConcurrentUploads;

  queueLogger.info("Starting batch upload", {
    totalFiles: files.length,
    concurrency,
  });

  // Process in chunks with concurrency limit
  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);

    const chunkResults = await Promise.allSettled(
      chunk.map(({ filePath, publicId, options }) =>
        uploadToCloudinary(filePath, publicId, options)
      )
    );

    results.push(...chunkResults);

    queueLogger.info("Batch upload chunk completed", {
      chunkIndex: Math.floor(i / concurrency) + 1,
      totalChunks: Math.ceil(files.length / concurrency),
      successful: chunkResults.filter((r) => r.status === "fulfilled").length,
      failed: chunkResults.filter((r) => r.status === "rejected").length,
    });
  }

  const successful = results.filter((r) => r.status === "fulfilled");
  const failed = results.filter((r) => r.status === "rejected");

  queueLogger.info("Batch upload completed", {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
  });

  return results;
};

/**
 * Get file metadata from Cloudinary
 * @param {String} publicId - Cloudinary public ID
 * @returns {Promise<Object>} File metadata
 */
export const getCloudinaryMetadata = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: CLOUDINARY_CONFIG.resourceType,
    });

    return {
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
      createdAt: result.created_at,
      url: result.secure_url,
    };
  } catch (error) {
    queueLogger.error("Failed to get Cloudinary metadata", {
      publicId,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Delete files older than specified hours
 * Used for cleanup job
 * @param {Number} hoursOld - Delete files older than this many hours
 * @param {String} folderPrefix - Folder prefix to search
 * @returns {Promise<Object>} Deletion summary
 */
export const deleteOldFiles = async (
  hoursOld = 24,
  folderPrefix = "cypherray/binaries"
) => {
  try {
    queueLogger.info("Starting cleanup of old files", {
      hoursOld,
      folderPrefix,
    });

    // Calculate cutoff timestamp
    const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

    // List all resources in folder
    let allResources = [];
    let nextCursor = null;

    do {
      const result = await cloudinary.api.resources({
        type: "private",
        resource_type: CLOUDINARY_CONFIG.resourceType,
        prefix: folderPrefix,
        max_results: 500,
        next_cursor: nextCursor,
      });

      allResources.push(...result.resources);
      nextCursor = result.next_cursor;
    } while (nextCursor);

    queueLogger.info("Found resources to check", {
      total: allResources.length,
    });

    // Filter files older than cutoff
    const oldFiles = allResources.filter((resource) => {
      const createdAt = new Date(resource.created_at);
      return createdAt < cutoffDate;
    });

    queueLogger.info("Files to delete", {
      count: oldFiles.length,
    });

    // Delete old files
    const deletePromises = oldFiles.map((file) =>
      deleteFromCloudinary(file.public_id)
    );

    const deleteResults = await Promise.allSettled(deletePromises);

    const deleted = deleteResults.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;
    const failed = deleteResults.length - deleted;

    queueLogger.info("Cleanup completed", {
      deleted,
      failed,
      totalChecked: allResources.length,
    });

    return {
      success: true,
      totalChecked: allResources.length,
      deleted,
      failed,
      cutoffDate: cutoffDate.toISOString(),
    };
  } catch (error) {
    queueLogger.error("Cleanup job failed", {
      error: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      error: error.message,
    };
  }
};
