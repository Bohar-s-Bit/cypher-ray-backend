import cron from "node-cron";
import {
  deleteOldFiles,
  deleteFromCloudinary,
} from "../utils/cloudinaryHelper.js";
import { queueLogger } from "../utils/logger.js";
import AnalysisJob from "../models/analysis.job.model.js";

/**
 * Cloudinary Cleanup Service
 * Deletes files older than 24 hours from Cloudinary
 * Runs daily at 2 AM
 */

class CloudinaryCleanupService {
  constructor() {
    this.isRunning = false;
    this.cronSchedule = "0 2 * * *"; // 2 AM daily
    this.hoursOld = 24; // Delete files older than 24 hours
  }

  /**
   * Start the cleanup cron job
   */
  start() {
    queueLogger.info("Starting Cloudinary cleanup service", {
      schedule: this.cronSchedule,
      hoursOld: this.hoursOld,
    });

    // Schedule daily cleanup at 2 AM
    cron.schedule(this.cronSchedule, async () => {
      await this.runCleanup();
    });

    queueLogger.info("Cloudinary cleanup service started");
  }

  /**
   * Run cleanup manually
   */
  async runCleanup() {
    if (this.isRunning) {
      queueLogger.warn("Cleanup already running, skipping");
      return;
    }

    this.isRunning = true;

    try {
      queueLogger.info("Starting Cloudinary cleanup job");

      // Delete old files from Cloudinary (24+ hours old)
      const cloudinaryResult = await deleteOldFiles(
        this.hoursOld,
        "cypherray/binaries"
      );

      queueLogger.info("Cloudinary cleanup completed", {
        totalChecked: cloudinaryResult.totalChecked,
        deleted: cloudinaryResult.deleted,
        failed: cloudinaryResult.failed,
      });

      // Also clean up database records for old completed/failed jobs
      // Keep jobs for 7 days for audit purposes
      const dbCleanupResult = await this.cleanupOldDatabaseRecords(7 * 24); // 7 days

      queueLogger.info("Database cleanup completed", {
        deleted: dbCleanupResult.deleted,
      });

      return {
        success: true,
        cloudinary: cloudinaryResult,
        database: dbCleanupResult,
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
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Clean up old database records
   * @param {Number} hoursOld - Delete records older than this many hours
   */
  async cleanupOldDatabaseRecords(hoursOld = 168) {
    // 7 days default
    try {
      const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

      queueLogger.info("Cleaning up old database records", {
        hoursOld,
        cutoffDate: cutoffDate.toISOString(),
      });

      // Delete old completed and failed jobs
      const result = await AnalysisJob.deleteMany({
        status: { $in: ["completed", "failed"] },
        completedAt: { $lt: cutoffDate },
      });

      queueLogger.info("Database records cleaned", {
        deleted: result.deletedCount,
      });

      return {
        success: true,
        deleted: result.deletedCount,
      };
    } catch (error) {
      queueLogger.error("Database cleanup failed", {
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
        deleted: 0,
      };
    }
  }

  /**
   * Clean up orphaned files (files with failed jobs)
   */
  async cleanupOrphanedFiles() {
    try {
      queueLogger.info("Cleaning up orphaned Cloudinary files");

      // Find failed jobs older than 1 hour with Cloudinary files
      const cutoffDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      const failedJobs = await AnalysisJob.find({
        status: "failed",
        cloudinaryPublicId: { $exists: true, $ne: null },
        completedAt: { $lt: cutoffDate },
      });

      queueLogger.info("Found failed jobs with files", {
        count: failedJobs.length,
      });

      let deletedCount = 0;

      for (const job of failedJobs) {
        try {
          await deleteFromCloudinary(job.cloudinaryPublicId);
          deletedCount++;

          queueLogger.info("Deleted orphaned file", {
            jobId: job._id.toString(),
            publicId: job.cloudinaryPublicId,
          });
        } catch (error) {
          queueLogger.error("Failed to delete orphaned file", {
            jobId: job._id.toString(),
            publicId: job.cloudinaryPublicId,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        checked: failedJobs.length,
        deleted: deletedCount,
      };
    } catch (error) {
      queueLogger.error("Orphaned files cleanup failed", {
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get cleanup statistics
   */
  async getStats() {
    try {
      // Count total jobs with Cloudinary files
      const totalWithCloudinary = await AnalysisJob.countDocuments({
        cloudinaryPublicId: { $exists: true, $ne: null },
      });

      // Count by status
      const completed = await AnalysisJob.countDocuments({
        cloudinaryPublicId: { $exists: true, $ne: null },
        status: "completed",
      });

      const failed = await AnalysisJob.countDocuments({
        cloudinaryPublicId: { $exists: true, $ne: null },
        status: "failed",
      });

      const queued = await AnalysisJob.countDocuments({
        cloudinaryPublicId: { $exists: true, $ne: null },
        status: { $in: ["queued", "processing"] },
      });

      return {
        totalWithCloudinary,
        byStatus: {
          completed,
          failed,
          queued,
        },
      };
    } catch (error) {
      queueLogger.error("Failed to get cleanup stats", {
        error: error.message,
      });
      return null;
    }
  }
}

// Create singleton instance
const cleanupService = new CloudinaryCleanupService();

// Export service and convenience functions
export default cleanupService;

export const startCleanupService = () => cleanupService.start();
export const runCleanupNow = () => cleanupService.runCleanup();
export const cleanupOrphanedFiles = () => cleanupService.cleanupOrphanedFiles();
export const getCleanupStats = () => cleanupService.getStats();
