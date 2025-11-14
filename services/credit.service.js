import User from "../models/user.model.js";
import CreditTransaction from "../models/credit.transaction.model.js";

/**
 * Credit Manager Service
 * Handles all credit-related operations and transactions
 */

/**
 * Add credits to user account
 * @param {String} userId - User ID
 * @param {Number} amount - Credits to add
 * @param {String} description - Transaction description
 * @param {String} type - Transaction type (credit, bonus, refund)
 * @returns {Object} Updated user and transaction
 */
export const addCredits = async (
  userId,
  amount,
  description = "Credits added",
  type = "credit"
) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const balanceBefore = user.credits.remaining;

    // Update credits
    user.credits.total += amount;
    user.credits.remaining += amount;

    const balanceAfter = user.credits.remaining;

    await user.save();

    // Log transaction
    const transaction = await CreditTransaction.create({
      userId,
      type,
      amount,
      description,
      balanceBefore,
      balanceAfter,
    });

    return {
      success: true,
      user,
      transaction,
    };
  } catch (error) {
    throw new Error(`Failed to add credits: ${error.message}`);
  }
};

/**
 * Deduct credits from user account
 * @param {String} userId - User ID
 * @param {Number} amount - Credits to deduct
 * @param {String} description - Transaction description
 * @param {String} jobId - Optional job ID
 * @returns {Object} Updated user and transaction
 */
export const deductCredits = async (
  userId,
  amount,
  description = "Credits used",
  jobId = null
) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user has enough credits
    if (user.credits.remaining < amount) {
      throw new Error("Insufficient credits");
    }

    const balanceBefore = user.credits.remaining;

    // Update credits
    user.credits.used += amount;
    user.credits.remaining -= amount;

    const balanceAfter = user.credits.remaining;

    await user.save();

    // Log transaction
    const transaction = await CreditTransaction.create({
      userId,
      type: "debit",
      amount,
      description,
      jobId,
      balanceBefore,
      balanceAfter,
    });

    return {
      success: true,
      user,
      transaction,
    };
  } catch (error) {
    throw new Error(`Failed to deduct credits: ${error.message}`);
  }
};

/**
 * Check if user has enough credits
 * @param {String} userId - User ID
 * @param {Number} amount - Credits required
 * @returns {Boolean} Has enough credits
 */
export const hasEnoughCredits = async (userId, amount) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    return user.credits.remaining >= amount;
  } catch (error) {
    throw new Error(`Failed to check credits: ${error.message}`);
  }
};

/**
 * Get user's credit balance
 * @param {String} userId - User ID
 * @returns {Object} Credit details
 */
export const getCreditBalance = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    return {
      total: user.credits.total,
      used: user.credits.used,
      remaining: user.credits.remaining,
      percentage:
        user.credits.total > 0
          ? ((user.credits.remaining / user.credits.total) * 100).toFixed(2)
          : 0,
    };
  } catch (error) {
    throw new Error(`Failed to get credit balance: ${error.message}`);
  }
};

/**
 * Get credit transaction history
 * @param {String} userId - User ID
 * @param {Object} options - Query options (page, limit)
 * @returns {Object} Transactions and pagination
 */
export const getCreditHistory = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const transactions = await CreditTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await CreditTransaction.countDocuments({ userId });

    return {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw new Error(`Failed to get credit history: ${error.message}`);
  }
};

/**
 * Set credits for user (admin only)
 * @param {String} userId - User ID
 * @param {Number} amount - Credits to set
 * @param {String} description - Transaction description
 * @returns {Object} Updated user and transaction
 */
export const setCredits = async (
  userId,
  amount,
  description = "Credits set by admin"
) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const balanceBefore = user.credits.remaining;

    // Set new credit amount
    user.credits.total = amount;
    user.credits.remaining = amount;
    user.credits.used = 0;

    const balanceAfter = user.credits.remaining;

    await user.save();

    // Log transaction
    const transaction = await CreditTransaction.create({
      userId,
      type: "credit",
      amount,
      description,
      balanceBefore,
      balanceAfter,
    });

    return {
      success: true,
      user,
      transaction,
    };
  } catch (error) {
    throw new Error(`Failed to set credits: ${error.message}`);
  }
};

/**
 * Get credits based on tier
 * @param {String} tierName - Tier name (tier1, tier2)
 * @returns {Number} Credit amount
 */
export const getTierCredits = (tierName) => {
  const tierCredits = {
    tier1: 1000, // Tier 1 - 1000 credits
    tier2: 500, // Tier 2 - 500 credits
  };

  return tierCredits[tierName] || 500; // Default to 500
};

/**
 * Get tier pricing information
 * @param {String} tierName - Tier name
 * @returns {Object} Tier details
 */
export const getTierInfo = (tierName) => {
  const tiers = {
    tier1: {
      name: "Tier 1",
      monthlyCredits: 1000,
      pricePerYear: 120000,
    },
    tier2: {
      name: "Tier 2",
      monthlyCredits: 500,
      pricePerYear: 60000,
    },
  };

  return tiers[tierName] || tiers.tier2;
};

/**
 * Deduct credits for SDK analysis (atomic operation)
 * @param {String} userId - User ID
 * @param {Number} amount - Credits to deduct
 * @param {String} jobId - Analysis job ID
 * @param {String} apiKeyId - API key ID
 * @returns {Object} Updated user and transaction
 */
export const deductCreditsForSDK = async (
  userId,
  amount,
  jobId,
  apiKeyId = null
) => {
  try {
    // Use MongoDB transaction for atomicity
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user has enough credits
    if (user.credits.remaining < amount) {
      throw new Error("Insufficient credits");
    }

    const balanceBefore = user.credits.remaining;

    // Update credits atomically
    user.credits.used += amount;
    user.credits.remaining -= amount;

    const balanceAfter = user.credits.remaining;

    await user.save();

    // Log transaction
    const transaction = await CreditTransaction.create({
      userId,
      type: "debit",
      amount,
      description: `SDK Binary Analysis - Job ${jobId}`,
      jobId,
      apiKeyId,
      balanceBefore,
      balanceAfter,
    });

    return {
      success: true,
      user,
      transaction,
    };
  } catch (error) {
    throw new Error(`Failed to deduct SDK credits: ${error.message}`);
  }
};

/**
 * Refund credits for failed SDK analysis
 * @param {String} userId - User ID
 * @param {Number} amount - Credits to refund
 * @param {String} jobId - Analysis job ID
 * @param {String} reason - Refund reason
 * @returns {Object} Updated user and transaction
 */
export const refundCreditsForSDK = async (userId, amount, jobId, reason) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const balanceBefore = user.credits.remaining;

    // Refund credits
    user.credits.used -= amount;
    user.credits.remaining += amount;

    // Ensure values don't go negative
    user.credits.used = Math.max(0, user.credits.used);

    const balanceAfter = user.credits.remaining;

    await user.save();

    // Log refund transaction
    const transaction = await CreditTransaction.create({
      userId,
      type: "refund",
      amount,
      description: `SDK Analysis Refund - ${reason} - Job ${jobId}`,
      jobId,
      balanceBefore,
      balanceAfter,
    });

    return {
      success: true,
      user,
      transaction,
    };
  } catch (error) {
    throw new Error(`Failed to refund SDK credits: ${error.message}`);
  }
};

