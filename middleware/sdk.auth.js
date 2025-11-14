import ApiKey from "../models/api.key.model.js";
import { sdkLogger } from "../utils/logger.js";

/**
 * API Key Authentication Middleware
 * Validates API key from X-API-Key header
 */
export const apiKeyAuth = async (req, res, next) => {
  try {
    // Extract API key from header
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      sdkLogger.warn("API request without API key", {
        ip: req.ip,
        path: req.path,
      });

      return res.status(401).json({
        success: false,
        message: "API key is required",
        code: "MISSING_API_KEY",
        details: {
          hint: "Include your API key in the X-API-Key header",
        },
      });
    }

    // Validate API key format
    if (!apiKey.startsWith("cray_")) {
      return res.status(401).json({
        success: false,
        message: "Invalid API key format",
        code: "INVALID_API_KEY_FORMAT",
      });
    }

    // Find API key in database
    const apiKeyDoc = await ApiKey.findOne({ key: apiKey }).populate(
      "userId",
      "-password"
    );

    if (!apiKeyDoc) {
      sdkLogger.warn("Invalid API key attempt", {
        key: apiKey.substring(0, 12) + "...",
        ip: req.ip,
      });

      return res.status(401).json({
        success: false,
        message: "Invalid API key",
        code: "INVALID_API_KEY",
        details: {
          hint: "Check your API key or generate a new one from the dashboard",
        },
      });
    }

    // Check if API key is active
    if (!apiKeyDoc.isActive) {
      sdkLogger.warn("Inactive API key usage attempt", {
        keyId: apiKeyDoc._id,
        userId: apiKeyDoc.userId._id,
      });

      return res.status(403).json({
        success: false,
        message: "API key is inactive",
        code: "INACTIVE_API_KEY",
        details: {
          hint: "This API key has been deactivated. Please use a different key or contact support.",
        },
      });
    }

    // Check if API key is expired
    if (apiKeyDoc.isExpired()) {
      sdkLogger.warn("Expired API key usage attempt", {
        keyId: apiKeyDoc._id,
        userId: apiKeyDoc.userId._id,
        expiresAt: apiKeyDoc.expiresAt,
      });

      return res.status(403).json({
        success: false,
        message: "API key has expired",
        code: "EXPIRED_API_KEY",
        details: {
          expiresAt: apiKeyDoc.expiresAt,
          hint: "Generate a new API key from the dashboard",
        },
      });
    }

    // Check if user account is active
    if (!apiKeyDoc.userId.isActive) {
      return res.status(403).json({
        success: false,
        message: "User account is inactive",
        code: "INACTIVE_ACCOUNT",
        details: {
          hint: "Your account has been deactivated. Please contact support.",
        },
      });
    }

    // Update API key usage (async - don't wait)
    apiKeyDoc.recordUsage().catch((err) => {
      sdkLogger.error("Failed to record API key usage", {
        keyId: apiKeyDoc._id,
        error: err.message,
      });
    });

    // Attach user and API key to request
    req.user = apiKeyDoc.userId;
    req.apiKey = apiKeyDoc;

    sdkLogger.info("API key authenticated", {
      userId: req.user._id,
      keyId: apiKeyDoc._id,
      keyName: apiKeyDoc.name,
      endpoint: req.path,
    });

    next();
  } catch (error) {
    sdkLogger.error("API key authentication error", {
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      message: "Authentication error",
      code: "AUTH_ERROR",
    });
  }
};

/**
 * Check specific permission
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.apiKey.permissions.includes(permission)) {
      sdkLogger.warn("Permission denied", {
        userId: req.user._id,
        keyId: req.apiKey._id,
        required: permission,
        has: req.apiKey.permissions,
      });

      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
        code: "PERMISSION_DENIED",
        details: {
          required: permission,
          hint: "This API key doesn't have the required permission",
        },
      });
    }

    next();
  };
};

export default { apiKeyAuth, requirePermission };
