import User from "../models/user.model.js";
import { generatePassword } from "../utils/generate.password.js";
import { sendWelcomeEmail } from "../utils/send.email.js";
import { getTierCredits, getTierInfo, addCredits } from "./credit.service.js";

/**
 * User Service
 * Handles user-related business logic
 */

/**
 * Create a new user/organization
 * @param {Object} userData - User data
 * @param {String} createdById - ID of admin creating the user
 * @returns {Object} Created user
 */
export const createUserService = async (userData, createdById) => {
  try {
    const { email, organizationName, userType, tier } = userData;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Generate username from email
    const username =
      email.split("@")[0] + "_" + Math.random().toString(36).substring(2, 6);

    // Generate secure password
    const tempPassword = generatePassword(10);

    // Get tier information and credits
    const tierInfo = getTierInfo(tier);
    const credits = getTierCredits(tier);

    // Create user
    const newUser = await User.create({
      username,
      email: email.toLowerCase(),
      password: tempPassword,
      userType: userType || "user",
      organizationName,
      credits: {
        total: credits,
        used: 0,
        remaining: credits,
      },
      tier: tier,
      tierInfo: tierInfo,
      isActive: true,
      createdBy: createdById,
    });

    // Send welcome email (async, don't wait)
    sendWelcomeEmail({
      email: newUser.email,
      username: newUser.username,
      password: tempPassword,
      organizationName: newUser.organizationName,
      tier: tierInfo?.name,
      credits: newUser.credits.remaining,
    }).catch((err) => console.error("Email sending failed:", err));

    // Return user without password
    const userObject = newUser.toObject();
    delete userObject.password;

    return {
      user: userObject,
      tempPassword, // Return for admin to see (won't be stored)
    };
  } catch (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }
};

/**
 * Get paginated users list
 * @param {Object} filters - Query filters
 * @param {Object} pagination - Pagination options
 * @returns {Object} Users and pagination info
 */
export const getUsersService = async (filters = {}, pagination = {}) => {
  try {
    const { userType, tier, isActive, search } = filters;
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    if (userType) {
      query.userType = userType;
    }
    
    if (tier) {
      query.tier = tier;
    }

    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { organizationName: { $regex: search, $options: "i" } },
      ];
    }

    // Get users
    const users = await User.find(query)
      .select("-password")
      .populate("createdBy", "username email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    return {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw new Error(`Failed to get users: ${error.message}`);
  }
};

/**
 * Get user by ID with details
 * @param {String} userId - User ID
 * @returns {Object} User details
 */
export const getUserByIdService = async (userId) => {
  try {
    const user = await User.findById(userId)
      .select("-password")
      .populate("createdBy", "username email organizationName");

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  } catch (error) {
    throw new Error(`Failed to get user: ${error.message}`);
  }
};

/**
 * Update user status (activate/deactivate)
 * @param {String} userId - User ID
 * @param {Boolean} isActive - Active status
 * @returns {Object} Updated user
 */
export const updateUserStatusService = async (userId, isActive) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select("-password");

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  } catch (error) {
    throw new Error(`Failed to update user status: ${error.message}`);
  }
};

/**
 * Delete user
 * @param {String} userId - User ID
 * @returns {Object} Deletion result
 */
export const deleteUserService = async (userId) => {
  try {
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      throw new Error("User not found");
    }

    return {
      success: true,
      message: "User deleted successfully",
    };
  } catch (error) {
    throw new Error(`Failed to delete user: ${error.message}`);
  }
};

/**
 * Get platform statistics
 * @returns {Object} Platform stats
 */
export const getPlatformStatsService = async () => {
  try {
    // Total users
    const totalUsers = await User.countDocuments();

    // Active users
    const activeUsers = await User.countDocuments({ isActive: true });

    // Users by tier
    const usersByTier = await User.aggregate([
      {
        $group: {
          _id: "$userType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Total credits distributed
    const creditStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalCreditsDistributed: { $sum: "$credits.total" },
          totalCreditsUsed: { $sum: "$credits.used" },
          totalCreditsRemaining: { $sum: "$credits.remaining" },
        },
      },
    ]);

    // Recent signups (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSignups = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      usersByTier,
      credits: creditStats[0] || {
        totalCreditsDistributed: 0,
        totalCreditsUsed: 0,
        totalCreditsRemaining: 0,
      },
      recentSignups,
      lastUpdated: new Date(),
    };
  } catch (error) {
    throw new Error(`Failed to get platform stats: ${error.message}`);
  }
};

/**
 * Update user profile
 * @param {String} userId - User ID
 * @param {Object} updates - Profile updates
 * @returns {Object} Updated user
 */
export const updateUserProfileService = async (userId, updates) => {
  try {
    const allowedUpdates = ["username", "organizationName"];
    const filteredUpdates = {};

    // Only allow specific fields to be updated
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const user = await User.findByIdAndUpdate(userId, filteredUpdates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  } catch (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }
};

/**
 * Change user password
 * @param {String} userId - User ID
 * @param {String} currentPassword - Current password
 * @param {String} newPassword - New password
 * @returns {Object} Success message
 */
export const changePasswordService = async (
  userId,
  currentPassword,
  newPassword
) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new Error("Current password is incorrect");
    }

    // Update password
    user.password = newPassword;
    await user.save();

    return {
      success: true,
      message: "Password changed successfully",
    };
  } catch (error) {
    throw new Error(`Failed to change password: ${error.message}`);
  }
};
