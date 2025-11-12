import User from "../models/user.model.js";
import { generateToken } from "../utils/jwt.js";
import { getCreditHistory } from "../services/credit.service.js";
import {
  updateUserProfileService,
  changePasswordService,
} from "../services/user.service.js";

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
