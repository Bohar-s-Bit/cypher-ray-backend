import express from "express";
import { auth } from "../middleware/auth.js";
import {
  userLogin,
  getUserProfile,
  getCreditHistoryController,
  changePassword,
  updateUserProfile,
  analyzeSingleUser,
  getUserJobResult,
  getUserAnalysisHistory,
  createUserApiKey,
  getUserApiKeys,
  revokeUserApiKey,
} from "../controllers/user.controllers.js";
import {
  loginValidation,
  changePasswordValidation,
  updateProfileValidation,
  paginationValidation,
} from "../middleware/validator.js";
import { creditCheck } from "../middleware/sdk.credit.js";
import { uploadSingle } from "../utils/file.handler.js";

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

/**
 * User Analysis Routes
 */

// Analyze single binary file (user dashboard)
router.post("/analyze", auth, uploadSingle, creditCheck(1), analyzeSingleUser);

// Get user's analysis history (user dashboard)
router.get("/analyze", auth, getUserAnalysisHistory);

// Get analysis job result (user dashboard)
router.get("/analyze/:jobId", auth, getUserJobResult);

/**
 * User API Key Management Routes
 */

// Create API key for self
router.post("/api-keys", auth, createUserApiKey);

// Get own API keys
router.get("/api-keys", auth, getUserApiKeys);

// Revoke own API key
router.delete("/api-keys/:keyId", auth, revokeUserApiKey);

export default router;
