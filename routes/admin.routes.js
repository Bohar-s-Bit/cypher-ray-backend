import express from "express";
import { adminAuth } from "../middleware/admin.auth.js";
import {
  adminLogin,
  createUser,
  getAllUsers,
  getUserDetails,
  updateUserCredits,
  updateUserStatus,
  deleteUser,
  getPlatformStats,
} from "../controllers/admin.controllers.js";
import {
  loginValidation,
  createUserValidation,
  updateCreditsValidation,
  updateStatusValidation,
  userIdValidation,
  paginationValidation,
} from "../middleware/validator.js";

const router = express.Router();

/**
 * Admin Authentication Routes
 */

// Admin login (no auth required)
router.post("/login", loginValidation, adminLogin);

/**
 * Admin User Management Routes
 * All routes below require admin authentication
 */

// Create new user/organization
router.post("/users/create", adminAuth, createUserValidation, createUser);

// Get all users with filters
router.get("/users", adminAuth, paginationValidation, getAllUsers);

// Get platform statistics
router.get("/stats", adminAuth, getPlatformStats);

// Get user details
router.get("/users/:userId", adminAuth, userIdValidation, getUserDetails);

// Update user credits
router.put(
  "/users/:userId/credits",
  adminAuth,
  updateCreditsValidation,
  updateUserCredits
);

// Update user status (activate/deactivate)
router.patch(
  "/users/:userId/status",
  adminAuth,
  updateStatusValidation,
  updateUserStatus
);

// Delete user
router.delete("/users/:userId", adminAuth, userIdValidation, deleteUser);

export default router;
