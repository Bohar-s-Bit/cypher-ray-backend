import express from "express";
import {
  getPlans,
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  getPaymentHistory,
  retryPayment,
  refundPayment,
} from "../controllers/payment.controller.js";
import { auth } from "../middleware/auth.js";
import { adminAuth } from "../middleware/admin.auth.js";
import {
  verifyPaymentOwnership,
  verifyWebhook,
} from "../middleware/payment.auth.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

/**
 * Rate Limiter for Payment Order Creation
 * Prevents abuse and rapid order creation
 */
const orderCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15, // 15 requests per hour
  message: {
    success: false,
    message: "Too many payment attempts. Please try again after an hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate Limiter for Payment Verification
 * Prevents brute force signature attacks
 */
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: {
    success: false,
    message: "Too many verification attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * GET /api/payment/plans
 * Get all credit plans
 */
router.get("/plans", getPlans);

// ============================================
// AUTHENTICATED ROUTES (User)
// ============================================

/**
 * POST /api/payment/create-order
 * Create Razorpay order for credit purchase
 * Body: { planId }
 */
router.post("/create-order", auth, orderCreationLimiter, createPaymentOrder);

/**
 * POST /api/payment/verify
 * Verify payment and add credits
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
router.post(
  "/verify",
  auth,
  verificationLimiter,
  verifyPaymentOwnership,
  verifyPayment
);

/**
 * GET /api/payment/history
 * Get user's payment history with pagination
 * Query: page, limit
 */
router.get("/history", auth, getPaymentHistory);

/**
 * POST /api/payment/retry
 * Retry failed payment
 * Body: { paymentId }
 */
router.post("/retry", auth, orderCreationLimiter, retryPayment);

// ============================================
// WEBHOOK ROUTES (Razorpay)
// ============================================

/**
 * POST /api/payment/webhook
 * Handle Razorpay webhooks
 * Automatically processes payment.captured and payment.failed events
 */
router.post("/webhook", verifyWebhook, handleWebhook);

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * POST /api/payment/refund
 * Refund a payment (Admin only)
 * Body: { paymentId, reason }
 */
router.post("/refund", adminAuth, refundPayment);

export default router;
