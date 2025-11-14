import { hasEnoughCredits } from "../services/credit.service.js";
import { sdkLogger } from "../utils/logger.js";

/**
 * Credit Check Middleware
 * Ensures user has sufficient credits before processing
 */
export const creditCheck = (creditsRequired = 1) => {
  return async (req, res, next) => {
    try {
      const userId = req.user._id;

      // Get actual credits required (may vary based on request)
      let requiredCredits = creditsRequired;

      // For batch requests, calculate based on number of files
      if (req.body?.files?.length) {
        requiredCredits = req.body.files.length;
      } else if (req.files?.length) {
        requiredCredits = req.files.length;
      }

      // Check if user has enough credits (this fetches fresh data from DB)
      const hasCredits = await hasEnoughCredits(userId, requiredCredits);

      if (!hasCredits) {
        // Get current balance for error message (fetch fresh data)
        const User = (await import("../models/user.model.js")).default;
        const user = await User.findById(userId);
        const available = user.credits.remaining;

        sdkLogger.warn("Insufficient credits", {
          userId: userId.toString(),
          required: requiredCredits,
          available,
          endpoint: req.path,
        });

        return res.status(402).json({
          success: false,
          message: "Insufficient credits",
          code: "INSUFFICIENT_CREDITS",
          details: {
            required: requiredCredits,
            available,
            deficit: requiredCredits - available,
            tier: user.tier,
            upgradeUrl: `${process.env.FRONTEND_URL}/credits`,
          },
        });
      }

      // Attach required credits to request for later use
      req.creditsRequired = requiredCredits;

      // Fetch fresh user data for accurate credit info
      const User = (await import("../models/user.model.js")).default;
      const freshUser = await User.findById(userId);

      sdkLogger.info("Credit check passed", {
        userId: userId.toString(),
        required: requiredCredits,
        available: freshUser.credits.remaining,
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
