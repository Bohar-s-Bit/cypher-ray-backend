import { queueLogger } from "../utils/logger.js";
import dynamicAnalysisService from "./dynamic.analysis.service.js";

/**
 * Analysis Service - Routes analysis through CAPEv2 Dynamic Sandbox
 */
class AnalysisService {
  /**
   * Analyze binary file using CAPEv2 dynamic sandbox
   * @param {String} filePath - Path to binary file
   * @param {String} filename - Original filename
   * @param {Boolean} forceDeep - Reserved for future use
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeBinary(filePath, filename, forceDeep = false) {
    try {
      queueLogger.info("Starting dynamic analysis", {
        filename,
        dynamicEnabled: dynamicAnalysisService.isEnabled(),
      });

      if (!dynamicAnalysisService.isEnabled()) {
        throw new Error(
          "Dynamic analysis is not enabled. Set DYNAMIC_ANALYSIS_ENABLED=true in .env",
        );
      }

      const dynamicResults = await dynamicAnalysisService.analyzeFile(
        filePath,
        filename,
        {
          platform: "windows",
          tags: "x64",
        },
      );

      queueLogger.info("Dynamic analysis completed", {
        filename,
        taskId: dynamicResults.taskId,
        malScore: dynamicResults.report.malScore,
        riskLevel: dynamicResults.report.riskLevel,
      });

      const results = this.buildDynamicOnlyResults(dynamicResults);

      queueLogger.info("Analysis finished", {
        filename,
        analysisMode: "dynamic-only",
        finalSeverity: results.vulnerability_assessment?.severity,
      });

      return results;
    } catch (error) {
      queueLogger.error("Analysis failed", {
        filename,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  }

  /**
   * Build results structure from dynamic analysis
   */
  buildDynamicOnlyResults(dynamicResults) {
    const report = dynamicResults.report;

    // Map dynamic results to expected format
    const severity =
      report.malScore >= 8.0
        ? "Critical"
        : report.malScore >= 5.0
          ? "High"
          : report.malScore >= 3.0
            ? "Medium"
            : report.malScore >= 1.0
              ? "Low"
              : "None";

    const vulnerabilities = report.signatures.map(
      (sig) =>
        `[DYNAMIC-${sig.severity.toUpperCase()}] ${sig.name}: ${sig.description}`,
    );

    return {
      file_metadata: {
        file_type: report.target?.file?.type || "Unknown",
        size_bytes: report.target?.file?.size || 0,
        md5: report.target?.file?.md5 || "",
        sha1: report.target?.file?.sha1 || "",
        sha256: report.target?.file?.sha256 || "",
        architecture: "x86-64",
        stripped: false,
      },
      detected_algorithms: [],
      function_analyses: [],
      detected_protocols: [],
      structural_analysis:
        "Dynamic analysis only - static analysis unavailable",
      library_usage: "Not analyzed (dynamic mode)",
      vulnerability_assessment: {
        has_vulnerabilities: report.malScore > 0,
        severity: severity,
        vulnerabilities: vulnerabilities,
        recommendations: [
          "File analyzed using behavioral analysis only",
          `Malware score: ${report.malScore}/10.0`,
          `Risk level: ${report.riskLevel}`,
        ],
        security_score: Math.max(0, 10 - report.malScore),
      },
      overall_assessment: `Dynamic behavioral analysis completed. Risk level: ${report.riskLevel}. Malware score: ${report.malScore}/10. Detected ${report.signatures.length} behavioral signatures.`,
      xai_explanation:
        report.signatures.map((s) => s.description).join(". ") ||
        "No suspicious behaviors detected during execution.",
      key_findings: report.signatures.map((s) => s.name),
      primary_purpose:
        report.riskLevel === "Clean"
          ? "Legitimate software"
          : "Potentially malicious behavior detected",
      dynamic_analysis: {
        enabled: true,
        taskId: dynamicResults.taskId,
        malScore: report.malScore,
        riskLevel: report.riskLevel,
        signatures: report.signatures,
        extractedKeys: report.extractedKeys,
        behavioralAnalysis: report.behavioralAnalysis,
        screenshots: report.screenshots,
        mode: "primary",
      },
      _analysis_metadata: {
        model_used: "CAPEv2 Dynamic Sandbox",
        provider: "Azure",
        analysis_mode: "dynamic-only",
        static_unavailable: true,
      },
    };
  }
}

export default new AnalysisService();
