import Razorpay from "razorpay";
import crypto from "crypto";
import logger from "../utils/logger.js";

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Create Razorpay Order
 * @param {Number} amount - Amount in paise
 * @param {String} currency - Currency code (default: INR)
 * @param {String} receipt - Receipt/Order ID for reference
 * @param {Object} notes - Additional notes
 * @returns {Promise<Object>} Razorpay order object
 */
export const createOrder = async (
  amount,
  currency = "INR",
  receipt,
  notes = {}
) => {
  try {
    const options = {
      amount, // Amount in paise
      currency,
      receipt,
      notes,
    };

    logger.info("[RAZORPAY] Creating order", { amount, currency, receipt });

    const order = await razorpay.orders.create(options);

    logger.info("[RAZORPAY] Order created successfully", {
      orderId: order.id,
      amount: order.amount,
    });

    return order;
  } catch (error) {
    logger.error("[RAZORPAY] Order creation failed", {
      error: error.message || error,
      stack: error.stack,
      amount,
      receipt,
    });
    throw new Error(
      `Razorpay order creation failed: ${
        error.message || JSON.stringify(error)
      }`
    );
  }
};

/**
 * Fetch Payment Details
 * @param {String} paymentId - Razorpay payment ID
 * @returns {Promise<Object>} Payment details
 */
export const fetchPayment = async (paymentId) => {
  try {
    logger.info("[RAZORPAY] Fetching payment details", { paymentId });

    const payment = await razorpay.payments.fetch(paymentId);

    logger.info("[RAZORPAY] Payment details fetched", {
      paymentId,
      status: payment.status,
    });

    return payment;
  } catch (error) {
    logger.error("[RAZORPAY] Payment fetch failed", {
      error: error.message,
      paymentId,
    });
    throw new Error(`Failed to fetch payment: ${error.message}`);
  }
};

/**
 * Capture Payment (if needed for authorized payments)
 * @param {String} paymentId - Razorpay payment ID
 * @param {Number} amount - Amount to capture in paise
 * @returns {Promise<Object>} Captured payment object
 */
export const capturePayment = async (paymentId, amount) => {
  try {
    logger.info("[RAZORPAY] Capturing payment", { paymentId, amount });

    const payment = await razorpay.payments.capture(paymentId, amount, "INR");

    logger.info("[RAZORPAY] Payment captured successfully", {
      paymentId,
      amount,
    });

    return payment;
  } catch (error) {
    logger.error("[RAZORPAY] Payment capture failed", {
      error: error.message,
      paymentId,
      amount,
    });
    throw new Error(`Payment capture failed: ${error.message}`);
  }
};

/**
 * Initiate Refund
 * @param {String} paymentId - Razorpay payment ID
 * @param {Number} amount - Amount to refund in paise (optional, full refund if not provided)
 * @param {Object} notes - Additional notes
 * @returns {Promise<Object>} Refund object
 */
export const createRefund = async (paymentId, amount = null, notes = {}) => {
  try {
    const options = { notes };
    if (amount) {
      options.amount = amount;
    }

    logger.warn("[RAZORPAY] Initiating refund", { paymentId, amount });

    const refund = await razorpay.payments.refund(paymentId, options);

    logger.warn("[RAZORPAY] Refund initiated successfully", {
      refundId: refund.id,
      paymentId,
      amount: refund.amount,
    });

    return refund;
  } catch (error) {
    logger.error("[RAZORPAY] Refund failed", {
      error: error.message,
      paymentId,
      amount,
    });
    throw new Error(`Refund failed: ${error.message}`);
  }
};

/**
 * Fetch Refund Status
 * @param {String} refundId - Razorpay refund ID
 * @returns {Promise<Object>} Refund details
 */
export const fetchRefund = async (refundId) => {
  try {
    logger.info("[RAZORPAY] Fetching refund status", { refundId });

    const refund = await razorpay.refunds.fetch(refundId);

    logger.info("[RAZORPAY] Refund status fetched", {
      refundId,
      status: refund.status,
    });

    return refund;
  } catch (error) {
    logger.error("[RAZORPAY] Refund fetch failed", {
      error: error.message,
      refundId,
    });
    throw new Error(`Failed to fetch refund: ${error.message}`);
  }
};

/**
 * Verify Payment Signature
 * CRITICAL SECURITY FUNCTION - Prevents fraudulent payments
 * @param {String} orderId - Razorpay order ID
 * @param {String} paymentId - Razorpay payment ID
 * @param {String} signature - Signature from client
 * @returns {Boolean} True if signature is valid
 */
export const verifyPaymentSignature = (orderId, paymentId, signature) => {
  try {
    const body = orderId + "|" + paymentId;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isValid = expectedSignature === signature;

    if (isValid) {
      logger.info("[RAZORPAY] ✅ Payment signature verified successfully", {
        orderId,
        paymentId,
      });
    } else {
      logger.error(
        "[RAZORPAY] ❌ INVALID PAYMENT SIGNATURE - POTENTIAL FRAUD",
        {
          orderId,
          paymentId,
          receivedSignature: signature,
        }
      );
    }

    return isValid;
  } catch (error) {
    logger.error("[RAZORPAY] Signature verification error", {
      error: error.message,
      orderId,
      paymentId,
    });
    return false;
  }
};

/**
 * Verify Webhook Signature
 * CRITICAL SECURITY FUNCTION - Prevents fake webhooks
 * @param {String} body - Webhook request body (stringified JSON)
 * @param {String} signature - X-Razorpay-Signature header
 * @returns {Boolean} True if webhook is authentic
 */
export const verifyWebhookSignature = (body, signature) => {
  try {
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    const isValid = expectedSignature === signature;

    if (isValid) {
      logger.info("[RAZORPAY] ✅ Webhook signature verified");
    } else {
      logger.error(
        "[RAZORPAY] ❌ INVALID WEBHOOK SIGNATURE - POTENTIAL ATTACK"
      );
    }

    return isValid;
  } catch (error) {
    logger.error("[RAZORPAY] Webhook verification error", {
      error: error.message,
    });
    return false;
  }
};

export default {
  createOrder,
  fetchPayment,
  capturePayment,
  createRefund,
  fetchRefund,
  verifyPaymentSignature,
  verifyWebhookSignature,
};
