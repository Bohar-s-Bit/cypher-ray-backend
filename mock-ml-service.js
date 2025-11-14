#!/usr/bin/env node

/**
 * Mock ML Service for CypherRay SDK Testing
 *
 * This is a simple Express server that simulates the Python ML service
 * for testing the CypherRay SDK integration without requiring the actual
 * ML model running on your friend's laptop.
 *
 * Usage: node mock-ml-service.js
 * Default port: 5000 (configurable via MODEL_PORT env variable)
 */

import express from "express";
import multer from "multer";
import crypto from "crypto";

const app = express();
const PORT = process.env.MODEL_PORT || 5000;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// Middleware
app.use(express.json());

// Mock vulnerability database
const MOCK_VULNERABILITIES = [
  {
    severity: "critical",
    type: "Buffer Overflow",
    description: "Potential buffer overflow vulnerability detected in firmware",
    cve: "CVE-2024-MOCK-001",
    location: "0x1000-0x1200",
  },
  {
    severity: "high",
    type: "Hardcoded Credentials",
    description: "Hardcoded credentials found in binary",
    cve: null,
    location: "0x2500-0x2600",
  },
  {
    severity: "medium",
    type: "Insecure Communication",
    description: "Unencrypted communication protocol detected",
    cve: "CVE-2024-MOCK-002",
    location: "0x3000-0x3500",
  },
  {
    severity: "low",
    type: "Weak Cryptography",
    description: "Weak cryptographic algorithm detected (MD5)",
    cve: null,
    location: "0x4000-0x4100",
  },
];

// Generate random but consistent results based on file hash
function generateMockAnalysis(fileBuffer) {
  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  // Use hash to deterministically select vulnerabilities
  const hashInt = parseInt(fileHash.substring(0, 8), 16);
  const vulnCount = (hashInt % 4) + 1; // 1-4 vulnerabilities

  const selectedVulnerabilities = [];
  for (let i = 0; i < vulnCount; i++) {
    const index = (hashInt + i) % MOCK_VULNERABILITIES.length;
    selectedVulnerabilities.push(MOCK_VULNERABILITIES[index]);
  }

  // Calculate risk score
  const severityScores = {
    critical: 10,
    high: 7,
    medium: 4,
    low: 2,
  };

  const totalScore = selectedVulnerabilities.reduce(
    (sum, vuln) => sum + severityScores[vuln.severity],
    0
  );
  const maxScore = vulnCount * 10;
  const riskScore = (totalScore / maxScore) * 100;

  return {
    fileHash,
    riskScore: Math.round(riskScore * 10) / 10,
    vulnerabilities: selectedVulnerabilities,
    totalVulnerabilities: vulnCount,
    severityBreakdown: {
      critical: selectedVulnerabilities.filter((v) => v.severity === "critical")
        .length,
      high: selectedVulnerabilities.filter((v) => v.severity === "high").length,
      medium: selectedVulnerabilities.filter((v) => v.severity === "medium")
        .length,
      low: selectedVulnerabilities.filter((v) => v.severity === "low").length,
    },
    metadata: {
      fileSize: fileBuffer.length,
      analysisTime: `${Math.random() * 5 + 2}s`,
      modelVersion: "mock-v1.0.0",
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Health check endpoint
 * GET /health
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "mock-ml-service",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Binary analysis endpoint
 * POST /analyze
 *
 * Accepts: multipart/form-data with 'file' field
 * Returns: Mock vulnerability assessment
 */
app.post("/analyze", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file provided",
      });
    }

    console.log(
      `[${new Date().toISOString()}] Analyzing binary: ${
        req.file.originalname
      } (${req.file.size} bytes)`
    );

    // Simulate processing time (500ms - 2s)
    const processingTime = Math.random() * 1500 + 500;
    await new Promise((resolve) => setTimeout(resolve, processingTime));

    // Generate mock analysis
    const analysis = generateMockAnalysis(req.file.buffer);

    console.log(
      `[${new Date().toISOString()}] Analysis complete: ${
        analysis.totalVulnerabilities
      } vulnerabilities found`
    );

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Batch analysis endpoint (optional)
 * POST /analyze/batch
 *
 * Accepts: multipart/form-data with multiple 'files' fields
 * Returns: Array of mock vulnerability assessments
 */
app.post("/analyze/batch", upload.array("files", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No files provided",
      });
    }

    console.log(
      `[${new Date().toISOString()}] Batch analyzing ${
        req.files.length
      } binaries`
    );

    // Simulate processing time
    const processingTime = Math.random() * 2000 + 1000;
    await new Promise((resolve) => setTimeout(resolve, processingTime));

    const results = req.files.map((file) => ({
      filename: file.originalname,
      analysis: generateMockAnalysis(file.buffer),
    }));

    console.log(`[${new Date().toISOString()}] Batch analysis complete`);

    res.json({
      success: true,
      data: {
        total: results.length,
        results,
      },
    });
  } catch (error) {
    console.error("Batch analysis error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(
    "\n╔══════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║                                                                  ║"
  );
  console.log(
    "║             Mock ML Service for CypherRay SDK Testing           ║"
  );
  console.log(
    "║                                                                  ║"
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════════╝\n"
  );
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ Analysis endpoint: http://localhost:${PORT}/analyze`);
  console.log("\n✓ Ready to accept binary analysis requests\n");
  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
  );
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\nShutting down mock ML service...");
  process.exit(0);
});
