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
   * Handles both new modular structure and legacy format
   */
  normalizeResults(rawResults) {
    // Check if using new modular prompting structure (has 'analysis' wrapper)
    const data = rawResults.analysis || rawResults;

    // Extract file metadata
    const fileMetadata = data.file_metadata || {};

    // Extract algorithms (new structure has more detailed fields)
    const algorithms = (data.detected_algorithms || []).map((algo) => ({
      algorithm_name: algo.name || algo.algorithm_name,
      confidence_score: algo.confidence || algo.confidence_score,
      algorithm_class: algo.type || algo.algorithm_class,
      structural_signature:
        algo.structural_signature || this._inferStructure(algo.name),
      evidence: algo.evidence || [],
      locations: algo.locations || [],
    }));

    // Extract functions (new structure uses detected_functions)
    const functions = (data.detected_functions || data.function_analyses || [])
      .map((func) => ({
        function_name: func.name || func.function_name,
        address: func.address,
        crypto_operations: func.crypto_operations || [],
        function_summary:
          func.explanation ||
          func.function_summary ||
          "Cryptographic function detected",
        semantic_tags: func.crypto_operations || func.semantic_tags || [],
        is_crypto: true,
        confidence_score: func.confidence || func.confidence_score || 0.7,
        related_algorithm: func.related_algorithm,
      }));

    // Extract protocols
    const protocols = data.detected_protocols || [];

    // Extract vulnerabilities (new modular structure)
    const vulnerabilities = data.vulnerabilities || [];
    const hasVulnerabilities = vulnerabilities.length > 0;
    const criticalVulns = vulnerabilities.filter(
      (v) => v.severity === "critical"
    );
    const highVulns = vulnerabilities.filter((v) => v.severity === "high");

    // Determine overall severity
    let severity = "None";
    if (criticalVulns.length > 0) {
      severity = "Critical";
    } else if (highVulns.length > 0) {
      severity = "High";
    } else if (vulnerabilities.length > 0) {
      severity = "Medium";
    }

    // Format vulnerabilities for storage
    const vulnDescriptions = vulnerabilities.map(
      (v) =>
        `[${v.severity.toUpperCase()}] ${v.type}: ${v.description}${
          v.extracted_value ? ` (Value: ${v.extracted_value})` : ""
        }`
    );

    // Extract recommendations (new structure)
    const recommendations = (data.recommendations || []).map(
      (rec) =>
        `[${rec.priority.toUpperCase()}] ${rec.category}: ${rec.recommendation}`
    );

    // Extract explainability
    const explainability = data.explainability || {};

    // Build structural analysis summary
    const structuralAnalysis = data.structural_analysis || {};
    const structuralSummary = [
      structuralAnalysis.crypto_patterns?.join(", "),
      `Code obfuscation: ${structuralAnalysis.code_obfuscation || "unknown"}`,
      `Implementation: ${structuralAnalysis.implementation_quality || "unknown"}`,
    ]
      .filter(Boolean)
      .join(". ");

    // Library usage
    const libraryUsage = data.library_usage || {};
    const libraryInfo = [
      ...(libraryUsage.identified_libraries || []),
      ...(libraryUsage.custom_implementations || []).map(
        (impl) => `Custom: ${impl}`
      ),
    ].join(", ");

    return {
      file_metadata: {
        file_type: fileMetadata.format || fileMetadata.file_type,
        size_bytes: fileMetadata.size || fileMetadata.size_bytes,
        md5: fileMetadata.md5,
        sha1: fileMetadata.sha1,
        sha256: fileMetadata.sha256,
        architecture: fileMetadata.architecture,
        stripped: fileMetadata.stripped,
      },
      detected_algorithms: algorithms,
      function_analyses: functions,
      detected_protocols: protocols,
      structural_analysis: structuralSummary,
      library_usage: libraryInfo,
      vulnerability_assessment: {
        has_vulnerabilities: hasVulnerabilities,
        severity: severity,
        vulnerabilities: vulnDescriptions,
        recommendations: recommendations,
        security_score: explainability.security_score || 0,
      },
      overall_assessment:
        explainability.summary ||
        data.overall_assessment ||
        "Analysis completed successfully",
      xai_explanation:
        explainability.detailed_explanation ||
        data.xai_explanation ||
        explainability.summary ||
        "",
      key_findings: explainability.key_findings || [],
      primary_purpose: explainability.primary_purpose,
      _analysis_metadata: data._analysis_metadata || {},
    };
  }

  /**
   * Infer structural pattern from algorithm name
   */
  _inferStructure(algorithmName) {
    if (!algorithmName) return null;
    const name = algorithmName.toLowerCase();
    if (name.includes("aes")) return "SPN";
    if (name.includes("des")) return "Feistel";
    if (name.includes("chacha") || name.includes("salsa")) return "ARX";
    if (name.includes("sha") || name.includes("md5")) return "Merkle-Damgård";
    return null;
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
