import express from "express";
import { auth } from "../middleware/auth.js";
import {
  userLogin,
  getUserProfile,
  getCreditHistoryController,
  changePassword,
  updateUserProfile,
} from "../controllers/user.controllers.js";
import {
  loginValidation,
  changePasswordValidation,
  updateProfileValidation,
  paginationValidation,
} from "../middleware/validator.js";

const router = express.Router();

/**
 * Public Routes
 */

// User login
router.post("/login", loginValidation, userLogin);

/**
 * Protected Routes (require authentication)
 */

// Get user profile
router.get("/profile", auth, getUserProfile);

// Update user profile
router.put("/profile", auth, updateProfileValidation, updateUserProfile);

// Get credit history
router.get(
  "/credits/history",
  auth,
  paginationValidation,
  getCreditHistoryController
);

// Change password
router.put("/password/change", auth, changePasswordValidation, changePassword);

export default router;
