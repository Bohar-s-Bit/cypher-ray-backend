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

const router = express.Router();

/**
 * Rate Limiting - DISABLED for troubleshooting
 * TODO: Re-enable after fixing issues
 */

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
router.post("/create-order", auth, createPaymentOrder);

/**
 * POST /api/payment/verify
 * Verify payment and add credits
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
router.post(
  "/verify",
  auth,
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
router.post("/retry", auth, retryPayment);

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
