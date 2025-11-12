import { auth } from "./auth.js";

/**
 * Admin authorization middleware
 * Extends auth middleware to check if user is admin
 */
export const adminAuth = async (req, res, next) => {
  // First authenticate the user
  await auth(req, res, () => {
    // Check if user is admin
    if (req.user.userType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    next();
  });
};
