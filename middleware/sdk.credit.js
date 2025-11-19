import { hasEnoughCredits } from "../services/credit.service.js";
import { sdkLogger } from "../utils/logger.js";

/**
 * Credit Check Middleware
 * Ensures user has minimum 5 credits before processing
 * NOTE: Credits are NOT deducted here - deducted after analysis completes
 */
export const creditCheck = (minimumRequired = 5) => {
  return async (req, res, next) => {
    try {
      const userId = req.user._id;

      // Fetch fresh user data
      const User = (await import("../models/user.model.js")).default;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      const available = user.credits.remaining;

      // Check minimum credit threshold (allows negative up to -5 before blocking)
      if (available < minimumRequired) {
        sdkLogger.warn("Insufficient credits for analysis", {
          userId: userId.toString(),
          available,
          minimumRequired,
          endpoint: req.path,
        });

        return res.status(402).json({
          success: false,
          message: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS",
          details: {
            required: minimumRequired,
            available,
            deficit: minimumRequired - available,
            tier: user.tier,
            upgradeUrl: `${process.env.FRONTEND_URL}/credits`,
          },
        });
      }

      sdkLogger.info("Credit check passed - analysis will proceed", {
        userId: userId.toString(),
        available,
        minimumRequired,
        note: "Credits will be deducted after analysis completes",
      });

      next();
    } catch (error) {
      sdkLogger.error("Credit check error", {
        error: error.message,
        stack: error.stack,
        userId: req.user?._id?.toString(),
      });

      return res.status(500).json({
        success: false,
        message: "Failed to check credits",
        code: "CREDIT_CHECK_ERROR",
      });
    }
  };
};

/**
 * Warn when credits are low
 */
export const lowCreditWarning = (req, res, next) => {
  const user = req.user;
  const threshold = 10; // Warn when less than 10 credits

  if (user.credits.remaining < threshold && user.credits.remaining > 0) {
    // Add warning header
    res.setHeader("X-Credits-Low", "true");
    res.setHeader("X-Credits-Remaining", user.credits.remaining);

    sdkLogger.info("Low credit warning", {
      userId: user._id.toString(),
      remaining: user.credits.remaining,
    });
  }

  next();
};

export default { creditCheck, lowCreditWarning };
