import mongoose from "mongoose";
import crypto from "crypto";

const apiKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      default: "Default API Key",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      default: null, // null means never expires
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    requestCount: {
      type: Number,
      default: 0,
    },
    permissions: {
      type: [String],
      default: ["sdk:analyze", "sdk:batch", "sdk:results", "sdk:credits"],
      enum: [
        "sdk:analyze",
        "sdk:batch",
        "sdk:results",
        "sdk:credits",
        "sdk:check-hash",
      ],
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      createdFrom: String,
    },
  },
  {
    timestamps: true,
  }
);

// Generate unique API key
apiKeySchema.statics.generateKey = function () {
  const prefix = "cray"; // cypherray prefix
  const randomBytes = crypto.randomBytes(32).toString("hex");
  return `${prefix}_${randomBytes}`;
};

// Check if key is expired
apiKeySchema.methods.isExpired = function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

// Update last used timestamp
apiKeySchema.methods.recordUsage = async function () {
  this.lastUsedAt = new Date();
  this.requestCount += 1;
  await this.save();
};

// Indexes for performance
apiKeySchema.index({ userId: 1, isActive: 1 });
apiKeySchema.index({ key: 1, isActive: 1 });
apiKeySchema.index({ expiresAt: 1 });

const ApiKey = mongoose.model("ApiKey", apiKeySchema);

export default ApiKey;
