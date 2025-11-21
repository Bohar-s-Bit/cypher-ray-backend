import mongoose from "mongoose";

const analysisJobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    apiKeyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApiKey",
      required: false, // Optional - not needed for user dashboard uploads
    },
    fileHash: {
      type: String,
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: false, // Now optional - kept for backwards compatibility
    },
    cloudinaryUrl: {
      type: String,
      required: false, // Secure URL from Cloudinary
    },
    cloudinaryPublicId: {
      type: String,
      required: false, // For deletion and management
      index: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
      index: true,
    },
    tier: {
      type: String,
      enum: ["tier1", "tier2"],
      default: "tier2",
    },
    priority: {
      type: Number,
      default: 2, // tier2 = priority 2 (lowest)
    },
    creditsDeducted: {
      type: Number,
      default: 0,
    },
    processingTimeSeconds: {
      type: Number,
      default: 0,
    },
    creditBreakdown: {
      baseCredits: {
        type: Number,
        default: 0,
      },
      timeCredits: {
        type: Number,
        default: 0,
      },
      complexityCredits: {
        type: Number,
        default: 0,
      },
      sizeTier: String, // tiny, small, medium, large, huge
      timeTier: String, // quick, normal, slow, heavy, extreme
      totalCalculated: {
        type: Number,
        default: 0,
      },
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    results: {
      file_metadata: {
        file_type: String,
        size_bytes: Number,
        md5: String,
        sha1: String,
        sha256: String,
        architecture: String,
        stripped: Boolean,
      },
      detected_algorithms: [
        {
          algorithm_name: String,
          confidence_score: Number,
          algorithm_class: String,
          structural_signature: String,
          evidence: [String],
          locations: [String],
        },
      ],
      function_analyses: [
        {
          function_name: String,
          address: String,
          crypto_operations: [String],
          function_summary: String,
          semantic_tags: [String],
          is_crypto: Boolean,
          confidence_score: Number,
          data_flow_pattern: String,
          related_algorithm: String,
        },
      ],
      detected_protocols: [
        {
          protocol: String,
          version: String,
          confidence: Number,
          evidence: [String],
          cipher_suites: [String],
          implementation_status: String,
          security_notes: String,
        },
      ],
      structural_analysis: String,
      library_usage: String,
      vulnerability_assessment: {
        has_vulnerabilities: Boolean,
        severity: String,
        vulnerabilities: [String],
        recommendations: [String],
        security_score: Number,
      },
      overall_assessment: String,
      xai_explanation: String,
      key_findings: [String],
      primary_purpose: String,
      _analysis_metadata: {
        model_used: String,
        provider: String,
        cost: Number,
        duration: Number,
        total_pipeline_cost: Number,
        stages_completed: Number,
      },
    },
    error: {
      message: String,
      stack: String,
      code: String,
    },
    queuedAt: {
      type: Date,
      default: Date.now,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    metadata: {
      sourceIp: String,
      userAgent: String,
      sdkVersion: String,
      ciPlatform: String, // github-actions, gitlab-ci, jenkins, etc.
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for performance
analysisJobSchema.index({ userId: 1, status: 1 });
analysisJobSchema.index({ fileHash: 1, userId: 1 });
analysisJobSchema.index({ status: 1, tier: 1, queuedAt: 1 });
analysisJobSchema.index({ createdAt: -1 });
analysisJobSchema.index({ cloudinaryPublicId: 1 }); // For Cloudinary operations
analysisJobSchema.index({ completedAt: 1 }); // For cleanup jobs

// Methods
analysisJobSchema.methods.updateStatus = async function (status, error = null) {
  this.status = status;

  if (status === "processing") {
    this.startedAt = new Date();
  } else if (status === "completed" || status === "failed") {
    this.completedAt = new Date();
    this.progress = status === "completed" ? 100 : this.progress;
  }

  if (error) {
    this.error = {
      message: error.message || error,
      stack: error.stack,
      code: error.code,
    };
  }

  await this.save();
};

analysisJobSchema.methods.updateProgress = async function (progress) {
  this.progress = Math.min(100, Math.max(0, progress));
  await this.save();
};

// Calculate processing time
analysisJobSchema.methods.getProcessingTime = function () {
  if (!this.startedAt) return 0;
  const endTime = this.completedAt || new Date();
  return Math.round((endTime - this.startedAt) / 1000); // seconds
};

const AnalysisJob = mongoose.model("AnalysisJob", analysisJobSchema);

export default AnalysisJob;
