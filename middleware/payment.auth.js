import Payment from "../models/payment.model.js";
import { verifyWebhookSignature } from "../services/razorpay.service.js";
import queueLogger from "../utils/logger.js";

/**
 * Verify Payment Ownership Middleware
 * Ensures user owns the payment they're trying to access/verify
 */
export const verifyPaymentOwnership = async (req, res, next) => {
  try {
    const { paymentId, razorpay_order_id } = req.body;
    const userId = req.user.id;

    // Find payment by either internal paymentId or razorpay_order_id
    let payment;
    if (paymentId) {
      payment = await Payment.findById(paymentId);
    } else if (razorpay_order_id) {
      payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    }

    if (!payment) {
      queueLogger.warn(`[PAYMENT AUTH] Payment not found - User: ${userId}`);
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Verify ownership
    if (payment.userId.toString() !== userId) {
      queueLogger.warn(
        `[PAYMENT AUTH] Unauthorized access attempt - User: ${userId}, Payment: ${payment._id}`
      );
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this payment",
      });
    }

    // Attach payment to request for controller use
    req.payment = payment;
    next();
  } catch (error) {
    queueLogger.error(
      `[PAYMENT AUTH] Error verifying ownership: ${error.message}`
    );
    return res.status(500).json({
      success: false,
      message: "Failed to verify payment ownership",
      error: error.message,
    });
  }
};

/**
 * Verify Razorpay Webhook Signature Middleware
 * Ensures webhook requests are from Razorpay
 */
export const verifyWebhook = (req, res, next) => {
  try {
    const webhookSignature = req.headers["x-razorpay-signature"];

    if (!webhookSignature) {
      queueLogger.warn("[WEBHOOK] Missing signature header");
      return res.status(400).json({
        success: false,
        message: "Missing webhook signature",
      });
    }

    // Verify signature using raw body
    const isValid = verifyWebhookSignature(
      req.rawBody || req.body,
      webhookSignature
    );

    if (!isValid) {
      queueLogger.error("[WEBHOOK] Invalid signature - possible fraud attempt");
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    queueLogger.info("[WEBHOOK] ✅ Signature verified successfully");
    next();
  } catch (error) {
    queueLogger.error(`[WEBHOOK] Verification error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Webhook verification failed",
      error: error.message,
    });
  }
};

export default {
  verifyPaymentOwnership,
  verifyWebhook,
};
