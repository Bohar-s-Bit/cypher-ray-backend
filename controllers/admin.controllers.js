import User from "../models/user.model.js";
import ApiKey from "../models/api.key.model.js";
import { generateToken } from "../utils/jwt.js";
import {
  createUserService,
  getUsersService,
  getUserByIdService,
  updateUserStatusService,
  deleteUserService,
  getPlatformStatsService,
} from "../services/user.service.js";
import {
  addCredits,
  setCredits,
  getCreditHistory,
} from "../services/credit.service.js";

/**
 * Admin login
 * POST /api/admin/login
 */
export const adminLogin = async (req, res) => {
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

    // Check if user is admin
    if (user.userType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
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
        message: "Your account has been deactivated",
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
    console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Create new user/organization
 * POST /api/admin/users/create
 */
export const createUser = async (req, res) => {
  try {
    const { email, organizationName, userType, tier } = req.body;

    const result = await createUserService(
      { email, organizationName, userType, tier },
      req.user._id
    );

    res.status(201).json({
      success: true,
      message:
        "User created successfully. Welcome email sent with credentials.",
      data: result,
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get all users with filters
 * GET /api/admin/users
 */
export const getAllUsers = async (req, res) => {
  try {
    const { userType, tier, isActive, search, page, limit } = req.query;

    const filters = {};
    if (userType) filters.userType = userType;
    if (tier) filters.tier = tier;
    if (isActive !== undefined) filters.isActive = isActive === "true";
    if (search) filters.search = search;

    const pagination = { page, limit };

    const result = await getUsersService(filters, pagination);

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve users",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get user details
 * GET /api/admin/users/:userId
 */
export const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await getUserByIdService(userId);

    // Get credit history
    const creditHistory = await getCreditHistory(userId, {
      page: 1,
      limit: 10,
    });

    res.status(200).json({
      success: true,
      message: "User details retrieved successfully",
      data: {
        user,
        creditHistory,
      },
    });
  } catch (error) {
    console.error("Get user details error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve user details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Update user credits
 * PUT /api/admin/users/:userId/credits
 */
export const updateUserCredits = async (req, res) => {
  try {
    const { userId } = req.params;
    const { credits, action } = req.body;

    let result;
    if (action === "add") {
      result = await addCredits(userId, credits, "Credits added by admin");
    } else if (action === "set") {
      result = await setCredits(userId, credits, "Credits set by admin");
    }

    res.status(200).json({
      success: true,
      message: `Credits ${action === "add" ? "added" : "set"} successfully`,
      data: {
        user: result.user,
        transaction: result.transaction,
      },
    });
  } catch (error) {
    console.error("Update credits error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update credits",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Activate/Deactivate user
 * PATCH /api/admin/users/:userId/status
 */
export const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await updateUserStatusService(userId, isActive);

    res.status(200).json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: { user },
    });
  } catch (error) {
    console.error("Update user status error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update user status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Delete user
 * DELETE /api/admin/users/:userId
 */
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent admin from deleting themselves
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const result = await deleteUserService(userId);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
      data: result,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get platform statistics
 * GET /api/admin/stats
 */
export const getPlatformStats = async (req, res) => {
  try {
    const stats = await getPlatformStatsService();

    res.status(200).json({
      success: true,
      message: "Platform statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Get platform stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve platform statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Create API Key for user (SDK Access)
 * POST /api/admin/users/:userId/api-keys
 */
export const createApiKey = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, expiresInDays, permissions } = req.body;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

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
      name: name || "SDK API Key",
      isActive: true,
      expiresAt,
      permissions: permissions || defaultPermissions,
      metadata: {
        createdFrom: "admin-panel",
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
          userId: apiKey.userId,
          userName: user.username,
          userEmail: user.email,
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
 * Get all API keys for a user
 * GET /api/admin/users/:userId/api-keys
 */
export const getUserApiKeys = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const apiKeys = await ApiKey.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "API keys retrieved successfully",
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
        apiKeys: apiKeys.map((key) => ({
          id: key._id,
          name: key.name,
          keyPreview: `${key.key.substring(0, 12)}...${key.key.substring(
            key.key.length - 4
          )}`,
          isActive: key.isActive,
          expiresAt: key.expiresAt,
          lastUsedAt: key.lastUsedAt,
          requestCount: key.requestCount,
          permissions: key.permissions,
          createdAt: key.createdAt,
        })),
        total: apiKeys.length,
      },
    });
  } catch (error) {
    console.error("Get user API keys error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve API keys",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Revoke (deactivate) API key
 * DELETE /api/admin/api-keys/:keyId
 */
export const revokeApiKey = async (req, res) => {
  try {
    const { keyId } = req.params;

    const apiKey = await ApiKey.findById(keyId);
    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: "API key not found",
      });
    }

    apiKey.isActive = false;
    await apiKey.save();

    res.status(200).json({
      success: true,
      message: "API key revoked successfully",
      data: {
        id: apiKey._id,
        name: apiKey.name,
        isActive: apiKey.isActive,
      },
    });
  } catch (error) {
    console.error("Revoke API key error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to revoke API key",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
