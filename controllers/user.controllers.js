import User from "../models/user.model.js";
import ApiKey from "../models/api.key.model.js";
import AnalysisJob from "../models/analysis.job.model.js";
import { generateToken } from "../utils/jwt.js";
import { getCreditHistory, deductCredits } from "../services/credit.service.js";
import {
  updateUserProfileService,
  changePasswordService,
} from "../services/user.service.js";
import { sdkAnalysisQueue } from "../config/queue.js";

/**
 * User login
 * POST /api/auth/login
 */
export const userLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken({ userId: user._id, userType: user.userType });

    // Remove password from response
    const userObject = user.toObject();
    delete userObject.password;

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: userObject,
      },
    });
  } catch (error) {
    console.error("User login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get user profile
 * GET /api/user/profile
 */
export const getUserProfile = async (req, res) => {
  try {
    // User is already attached to req by auth middleware
    const user = req.user;

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      data: { user },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get credit history
 * GET /api/user/credits/history
 */
export const getCreditHistoryController = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const result = await getCreditHistory(req.user._id, { page, limit });

    res.status(200).json({
      success: true,
      message: "Credit history retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get credit history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve credit history",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Change password
 * PUT /api/user/password/change
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const result = await changePasswordService(
      req.user._id,
      currentPassword,
      newPassword
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to change password",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update user profile
 * PUT /api/user/profile
 */
export const updateUserProfile = async (req, res) => {
  try {
    const { username, organizationName } = req.body;

    const user = await updateUserProfileService(req.user._id, {
      username,
      organizationName,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: { user },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Analyze single binary file (User Dashboard)
 * POST /api/user/analyze
 */
export const analyzeSingleUser = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.user._id;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
        code: "NO_FILE",
      });
    }

    // Use Cloudinary etag as file hash (consistent with SDK)
    const fileHash = file.etag || `cloudinary-${file.filename}`;

    // Check for existing analysis with same hash
    const existingJob = await AnalysisJob.findOne({
      userId,
      fileHash,
      status: { $in: ["completed", "processing", "queued"] },
    }).sort({ createdAt: -1 });

    if (existingJob) {
      return res.status(200).json({
        success: true,
        message: "File already analyzed",
        cached: true,
        data: {
          job: {
            jobId: existingJob._id.toString(),
            filename: existingJob.filename,
            status: existingJob.status,
            tier: existingJob.tier,
            progress: existingJob.progress,
            results: existingJob.results,
            createdAt: existingJob.createdAt,
            completedAt: existingJob.completedAt,
          },
        },
      });
    }

    // Create analysis job
    const job = await AnalysisJob.create({
      userId,
      filename: file.originalname,
      fileSize: file.size,
      fileHash,
      cloudinaryUrl: file.path,
      cloudinaryPublicId: file.filename,
      status: "queued",
      tier: req.user.tier,
      metadata: {
        source: "user-dashboard",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      },
    });

    // Deduct credits
    await deductCredits(userId, 1, "Binary analysis", job._id.toString());

    // Add to queue
    await sdkAnalysisQueue.add(
      req.user.tier,
      {
        jobId: job._id.toString(),
        userId: userId.toString(),
        cloudinaryUrl: file.path,
        cloudinaryPublicId: file.filename,
        fileHash,
        filename: file.originalname,
        tier: req.user.tier,
      },
      {
        priority: req.user.tier === "tier1" ? 1 : 2,
        jobId: job._id.toString(),
      }
    );

    res.status(202).json({
      success: true,
      message: "Analysis job queued successfully",
      cached: false,
      creditsCharged: 1,
      data: {
        job: {
          jobId: job._id.toString(),
          filename: file.originalname,
          status: job.status,
          tier: job.tier,
          createdAt: job.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("User analyze error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to analyze file",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get analysis job result (User Dashboard)
 * GET /api/user/analyze/:jobId
 */
export const getUserJobResult = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user._id;

    const job = await AnalysisJob.findOne({ _id: jobId, userId });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        job: {
          jobId: job._id.toString(),
          filename: job.filename,
          status: job.status,
          tier: job.tier,
          progress: job.progress,
          results: job.results,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          error: job.error,
        },
      },
    });
  } catch (error) {
    console.error("Error getting job result:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get job result",
    });
  }
};

/**
 * Get user's analysis history
 * GET /api/user/analyze?page=1&limit=20
 */
export const getUserAnalysisHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      AnalysisJob.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "_id filename status tier progress results createdAt completedAt error"
        ),
      AnalysisJob.countDocuments({ userId }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        jobs: jobs.map((job) => ({
          jobId: job._id.toString(),
          filename: job.filename,
          status: job.status,
          tier: job.tier,
          progress: job.progress,
          hasVulnerabilities:
            job.results?.vulnerability_assessment?.has_vulnerabilities,
          severity: job.results?.vulnerability_assessment?.severity,
          vulnerabilityCount:
            job.results?.vulnerability_assessment?.vulnerabilities?.length || 0,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          error: job.error,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get user job result error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get job result",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Create API Key for self
 * POST /api/user/api-keys
 */
export const createUserApiKey = async (req, res) => {
  try {
    const { name, expiresInDays } = req.body;
    const userId = req.user._id;

    // Calculate expiration date
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Default permissions
    const defaultPermissions = [
      "sdk:analyze",
      "sdk:batch",
      "sdk:results",
      "sdk:credits",
      "sdk:check-hash",
    ];

    // Generate API key
    const key = ApiKey.generateKey();

    const apiKey = await ApiKey.create({
      key,
      userId,
      name: name || "API Key",
      isActive: true,
      expiresAt,
      permissions: defaultPermissions,
      metadata: {
        createdFrom: "user-dashboard",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      },
    });

    res.status(201).json({
      success: true,
      message: "API key created successfully",
      data: {
        apiKey: {
          id: apiKey._id,
          key: apiKey.key,
          name: apiKey.name,
          isActive: apiKey.isActive,
          expiresAt: apiKey.expiresAt,
          permissions: apiKey.permissions,
          createdAt: apiKey.createdAt,
        },
        warning:
          "Store this API key securely. It won't be shown again in full.",
      },
    });
  } catch (error) {
    console.error("Create API key error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create API key",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get own API keys
 * GET /api/user/api-keys
 */
export const getUserApiKeys = async (req, res) => {
  try {
    const userId = req.user._id;

    const apiKeys = await ApiKey.find({ userId })
      .select("-key")
      .sort({ createdAt: -1 });

    // Add masked keys for display
    const maskedKeys = apiKeys.map((key) => ({
      ...key.toObject(),
      keyPreview: `cray_****${key._id.toString().slice(-8)}`,
    }));

    res.status(200).json({
      success: true,
      message: "API keys retrieved successfully",
      data: {
        apiKeys: maskedKeys,
        total: apiKeys.length,
      },
    });
  } catch (error) {
    console.error("Get API keys error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve API keys",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Revoke own API key
 * DELETE /api/user/api-keys/:keyId
 */
export const revokeUserApiKey = async (req, res) => {
  try {
    const { keyId } = req.params;
    const userId = req.user._id;

    const apiKey = await ApiKey.findOne({ _id: keyId, userId });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: "API key not found",
      });
    }

    // Soft delete - mark as inactive
    apiKey.isActive = false;
    apiKey.revokedAt = new Date();
    apiKey.revokedBy = userId;
    await apiKey.save();

    res.status(200).json({
      success: true,
      message: "API key revoked successfully",
      data: {
        apiKey: {
          id: apiKey._id,
          name: apiKey.name,
          revokedAt: apiKey.revokedAt,
        },
      },
    });
  } catch (error) {
    console.error("Revoke API key error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to revoke API key",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
