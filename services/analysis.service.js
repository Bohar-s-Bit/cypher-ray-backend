import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { queueLogger } from "../utils/logger.js";

/**
 * Analysis Service - Communicates with Python ML Service
 */
class AnalysisService {
  constructor() {
    this.mlServiceUrl =
      process.env.MODEL_URL || "http://localhost:5000/analyze";
    this.timeout = 300000; // 5 minutes
  }

  /**
   * Analyze binary file using ML service
   * @param {String} filePath - Path to binary file
   * @param {String} filename - Original filename
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeBinary(filePath, filename) {
    try {
      queueLogger.info("Starting ML analysis", {
        filename,
        mlServiceUrl: this.mlServiceUrl,
      });

      // Create form data
      const formData = new FormData();
      formData.append("file", fs.createReadStream(filePath), {
        filename,
        contentType: "application/octet-stream",
      });

      // Call ML service
      const response = await axios.post(this.mlServiceUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          "X-Service": "cypherray-sdk",
        },
        timeout: this.timeout,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      if (!response.data) {
        throw new Error("Empty response from ML service");
      }

      queueLogger.info("ML analysis completed", {
        filename,
        hasVulnerabilities:
          response.data.vulnerability_assessment?.has_vulnerabilities,
        severity: response.data.vulnerability_assessment?.severity,
      });

      return this.normalizeResults(response.data);
    } catch (error) {
      queueLogger.error("ML analysis failed", {
        filename,
        error: error.message,
        stack: error.stack,
        response: error.response?.data,
      });

      // Check if it's a timeout
      if (error.code === "ECONNABORTED") {
        throw new Error("Analysis timeout - file may be too large or complex");
      }

      // Check if ML service is down
      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        throw new Error("ML service unavailable - please try again later");
      }

      throw new Error(
        `ML analysis failed: ${error.response?.data?.message || error.message}`
      );
    }
  }

  /**
   * Normalize ML results to consistent format
   */
  normalizeResults(rawResults) {
    return {
      file_metadata: rawResults.file_metadata || {},
      detected_algorithms: rawResults.detected_algorithms || [],
      function_analyses: rawResults.function_analyses || [],
      vulnerability_assessment: {
        has_vulnerabilities:
          rawResults.vulnerability_assessment?.has_vulnerabilities || false,
        severity: rawResults.vulnerability_assessment?.severity || "None",
        vulnerabilities:
          rawResults.vulnerability_assessment?.vulnerabilities || [],
        recommendations:
          rawResults.vulnerability_assessment?.recommendations || [],
      },
      overall_assessment: rawResults.overall_assessment || "",
      xai_explanation: rawResults.xai_explanation || "",
    };
  }

  /**
   * Check ML service health
   */
  async checkHealth() {
    try {
      const healthUrl = this.mlServiceUrl.replace("/analyze", "/health");
      const response = await axios.get(healthUrl, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      queueLogger.warn("ML service health check failed", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get mock results for testing (when ML service is down)
   */
  getMockResults(filename) {
    queueLogger.warn("Using mock results - ML service unavailable", {
      filename,
    });

    return {
      file_metadata: {
        file_type: "Binary Executable",
        size_bytes: 0,
        md5: "",
        sha1: "",
        sha256: "",
      },
      detected_algorithms: [
        {
          algorithm_name: "AES-128",
          confidence_score: 0.95,
          algorithm_class: "Symmetric Encryption",
          structural_signature: "SPN",
        },
      ],
      function_analyses: [
        {
          function_name: "_crypto_function",
          function_summary: "Cryptographic function detected",
          semantic_tags: ["encryption", "crypto"],
          is_crypto: true,
          confidence_score: 0.9,
          data_flow_pattern: null,
        },
      ],
      vulnerability_assessment: {
        has_vulnerabilities: false,
        severity: "None",
        vulnerabilities: [],
        recommendations: [
          "ML service unavailable - using mock results for testing",
        ],
      },
      overall_assessment:
        "Mock analysis result - ML service unavailable. Please check ML service status.",
      xai_explanation:
        "This is a mock result returned because the ML analysis service is currently unavailable.",
    };
  }
}

export default new AnalysisService();
