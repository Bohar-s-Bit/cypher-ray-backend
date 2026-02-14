import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { queueLogger } from "../utils/logger.js";

/**
 * Dynamic Analysis Service - Integrates with CAPEv2 Sandbox
 * Handles behavioral analysis and key extraction for suspicious binaries
 */
class DynamicAnalysisService {
  constructor() {
    this.enabled = process.env.DYNAMIC_ANALYSIS_ENABLED === "true";
    this.hostIp = process.env.DYNAMIC_HOST_IP || "4.186.27.221";
    this.port = process.env.DYNAMIC_PORT || "8000";
    this.apiUrl =
      process.env.DYNAMIC_API_URL || `http://${this.hostIp}:${this.port}`;
    this.apiToken = process.env.DYNAMIC_API_TOKEN || "";
    this.timeout = parseInt(process.env.DYNAMIC_TIMEOUT || "240", 10) * 1000; // Convert to ms
    this.pollInterval =
      parseInt(process.env.DYNAMIC_POLL_INTERVAL || "30", 10) * 1000; // Convert to ms
    this.maxPollingAttempts = parseInt(
      process.env.DYNAMIC_MAX_POLL_ATTEMPTS || "40",
      10,
    ); // Default: 20 minutes (40 * 30s)
  }

  /**
   * Check if dynamic analysis is enabled and configured
   */
  isEnabled() {
    if (!this.enabled) {
      return false;
    }
    if (!this.apiToken) {
      queueLogger.warn(
        "Dynamic analysis is enabled but API token is not configured",
      );
      return false;
    }
    return true;
  }

  /**
   * Submit file for dynamic analysis
   * @param {String} filePath - Path to binary file
   * @param {String} filename - Original filename
   * @param {Object} options - Analysis options (hookOffset, machine, etc.)
   * @returns {Promise<Object>} Task submission result with task_id
   */
  async submitFile(filePath, filename, options = {}) {
    try {
      if (!this.isEnabled()) {
        throw new Error(
          "Dynamic analysis is not enabled or not properly configured",
        );
      }

      queueLogger.info("Submitting file to dynamic analysis", {
        filename,
        apiUrl: this.apiUrl,
        options,
      });

      // Create form data
      const formData = new FormData();
      formData.append("file", fs.createReadStream(filePath), {
        filename,
        contentType: "application/octet-stream",
      });

      // Add analysis options
      formData.append("platform", options.platform || "windows");
      formData.append("tags", options.tags || "x64");
      formData.append("timeout", options.timeout || "200");

      // If static analysis found a crypto loop, pass the hook offset
      if (options.hookOffset) {
        formData.append("options", `hookoffset=${options.hookOffset}`);
      }

      // Machine type (default: win10)
      if (options.machine) {
        formData.append("machine", options.machine);
      } else {
        formData.append("machine", "win10");
      }

      // Submit to sandbox
      const response = await axios.post(
        `${this.apiUrl}/apiv2/tasks/create/file/`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Token ${this.apiToken}`,
          },
          timeout: this.timeout,
        },
      );

      if (
        !response.data ||
        !response.data.data ||
        !response.data.data.task_ids
      ) {
        throw new Error("Invalid response from dynamic analysis API");
      }

      const taskId = response.data.data.task_ids[0];

      queueLogger.info("File submitted to dynamic analysis", {
        filename,
        taskId,
      });

      return {
        success: true,
        taskId,
        message: "File submitted for dynamic analysis",
      };
    } catch (error) {
      queueLogger.error("Dynamic analysis submission failed", {
        filename,
        error: error.message,
        stack: error.stack,
        response: error.response?.data,
      });

      // Check specific error types
      if (error.response?.status === 401) {
        throw new Error(
          "Dynamic analysis authentication failed - check API token",
        );
      }

      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        throw new Error(
          "Dynamic analysis service unavailable - connection refused",
        );
      }

      throw new Error(
        `Dynamic analysis submission failed: ${
          error.response?.data?.message || error.message
        }`,
      );
    }
  }

  /**
   * Check task status
   * @param {String} taskId - Task ID from submission
   * @returns {Promise<Object>} Status information
   */
  async checkStatus(taskId) {
    try {
      const response = await axios.get(
        `${this.apiUrl}/apiv2/tasks/status/${taskId}/`,
        {
          headers: {
            Authorization: `Token ${this.apiToken}`,
          },
          timeout: 30000, // 30 seconds
        },
      );

      const status = response.data?.data;

      queueLogger.debug("Status check response", {
        taskId,
        status,
        rawResponse: response.data,
      });

      // CAPE uses various failure statuses: failed, failed_analysis, failed_processing, failed_reporting
      const failedStatuses = ["failed", "failed_analysis", "failed_processing", "failed_reporting"];

      return {
        taskId,
        status,
        isComplete: status === "reported",
        isPending: ["pending", "running", "completed", "processing"].includes(status),
        isFailed: failedStatuses.includes(status),
        rawData: response.data,
      };
    } catch (error) {
      queueLogger.error("Dynamic analysis status check failed", {
        taskId,
        error: error.message,
      });

      throw new Error(
        `Status check failed: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  /**
   * Get full analysis report
   * @param {String} taskId - Task ID from submission
   * @returns {Promise<Object>} Full analysis report
   */
  async getReport(taskId) {
    try {
      const response = await axios.get(
        `${this.apiUrl}/apiv2/tasks/get/report/${taskId}/json/`,
        {
          headers: {
            Authorization: `Token ${this.apiToken}`,
          },
          timeout: 60000, // 60 seconds
        },
      );

      if (!response.data) {
        throw new Error("Empty report received");
      }

      return this.parseReport(response.data);
    } catch (error) {
      queueLogger.error("Dynamic analysis report retrieval failed", {
        taskId,
        error: error.message,
      });

      if (error.response?.status === 404) {
        throw new Error("Report not found - analysis may have failed");
      }

      throw new Error(
        `Report retrieval failed: ${
          error.response?.data?.message || error.message
        }`,
      );
    }
  }

  /**
   * Poll task status until complete or timeout
   * @param {String} taskId - Task ID to poll
   * @returns {Promise<Object>} Final status
   */
  async pollUntilComplete(taskId) {
    let attempts = 0;

    while (attempts < this.maxPollingAttempts) {
      const statusInfo = await this.checkStatus(taskId);

      if (statusInfo.isComplete) {
        queueLogger.info("Dynamic analysis completed", {
          taskId,
          attempts,
        });
        return statusInfo;
      }

      if (statusInfo.isFailed) {
        queueLogger.error("Dynamic analysis task failed", {
          taskId,
          status: statusInfo.status,
          attempts,
        });
        throw new Error(`Dynamic analysis failed with status: ${statusInfo.status}`);
      }

      // Still running, wait and retry
      attempts++;

      // Log less frequently to reduce noise (every 5th attempt after first 3)
      const shouldLog = attempts <= 3 || attempts % 5 === 0;
      if (shouldLog) {
        queueLogger.info("Dynamic analysis in progress", {
          taskId,
          status: statusInfo.status,
          attempt: attempts,
          maxAttempts: this.maxPollingAttempts,
          nextCheckIn: `${this.pollInterval / 1000}s`,
          estimatedTimeLeft: `${((this.maxPollingAttempts - attempts) * this.pollInterval) / 60000}min`,
        });
      }

      await this.sleep(this.pollInterval);
    }

    throw new Error(
      "Dynamic analysis timeout - exceeded maximum polling attempts",
    );
  }

  /**
   * Complete workflow: Submit, Poll, and Retrieve
   * @param {String} filePath - Path to binary file
   * @param {String} filename - Original filename
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Complete analysis results
   */
  async analyzeFile(filePath, filename, options = {}) {
    try {
      queueLogger.info("Starting dynamic analysis workflow", { filename });

      // Phase A: Submit file
      const submission = await this.submitFile(filePath, filename, options);
      const taskId = submission.taskId;

      // Phase B: Poll until complete
      await this.pollUntilComplete(taskId);

      // Phase C: Retrieve report
      const report = await this.getReport(taskId);

      queueLogger.info("Dynamic analysis workflow completed", {
        filename,
        taskId,
        malScore: report.malScore,
      });

      return {
        success: true,
        taskId,
        report,
      };
    } catch (error) {
      queueLogger.error("Dynamic analysis workflow failed", {
        filename,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Parse and normalize report data
   * @param {Object} rawReport - Raw report from CAPEv2
   * @returns {Object} Normalized report
   */
  parseReport(rawReport) {
    const report = {
      malScore: rawReport.malscore || 0,
      signatures: (rawReport.signatures || []).map((sig) => ({
        name: sig.name || sig.description,
        severity: sig.severity || "info",
        description: sig.description || sig.name,
        marks: sig.marks || [],
      })),
      extractedKeys: [],
      behavioralAnalysis: {
        processTree: rawReport.behavior?.processtree || [],
        networkActivity: rawReport.network || {},
        fileOperations: rawReport.behavior?.summary?.files || [],
        registryOperations: rawReport.behavior?.summary?.registry || [],
      },
      screenshots: rawReport.screenshots || [],
      target: rawReport.target || {},
      info: rawReport.info || {},
    };

    // Extract crypto keys if available
    if (rawReport.cape && rawReport.cape.payloads) {
      report.extractedKeys = rawReport.cape.payloads.map((payload) => ({
        type: payload.yara_signatures || "Unknown",
        data: payload.config || payload.cape_config,
        sha256: payload.sha256,
      }));
    }

    // Calculate risk level based on mal score
    if (report.malScore >= 8.0) {
      report.riskLevel = "Critical";
    } else if (report.malScore >= 5.0) {
      report.riskLevel = "High";
    } else if (report.malScore >= 3.0) {
      report.riskLevel = "Medium";
    } else if (report.malScore >= 1.0) {
      report.riskLevel = "Low";
    } else {
      report.riskLevel = "Clean";
    }

    return report;
  }

  /**
   * Sleep utility for polling
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check service health
   */
  async checkHealth() {
    try {
      if (!this.isEnabled()) {
        return { healthy: false, reason: "Service not enabled" };
      }

      const response = await axios.get(`${this.apiUrl}/apiv2/`, {
        headers: {
          Authorization: `Token ${this.apiToken}`,
        },
        timeout: 5000,
      });

      return {
        healthy: response.status === 200,
        version: response.data?.version || "unknown",
      };
    } catch (error) {
      queueLogger.warn("Dynamic analysis health check failed", {
        error: error.message,
      });
      return {
        healthy: false,
        reason: error.message,
      };
    }
  }
}

export default new DynamicAnalysisService();
