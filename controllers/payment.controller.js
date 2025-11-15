import Payment from "../models/payment.model.js";
import User from "../models/user.model.js";
import {
  createOrder,
  verifyPaymentSignature,
  fetchPayment,
  createRefund,
} from "../services/razorpay.service.js";
import { addCreditsFromPayment } from "../services/credit.service.js";
import {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
} from "../services/payment.email.service.js";
import queueLogger from "../utils/logger.js";
import mongoose from "mongoose";

// Credit plans with pricing (amounts in paise)
const CREDIT_PLANS = [
  {
    id: "basic",
    name: "Basic",
    credits: 100,
    price: 1000, // ₹1,000
    amount: 100000, // in paise
    popular: false,
  },
  {
    id: "standard",
    name: "Standard",
    credits: 500,
    price: 4500, // ₹4,500
    amount: 450000, // in paise
    popular: true, // ⭐ Popular
  },
  {
    id: "premium",
    name: "Premium",
    credits: 1000,
    price: 8000, // ₹8,000
    amount: 800000, // in paise
    popular: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    credits: 3000,
    price: 20000, // ₹20,000
    amount: 2000000, // in paise
    popular: false,
  },
  {
    id: "ultimate",
    name: "Ultimate",
    credits: 5000,
    price: 30000, // ₹30,000
    amount: 3000000, // in paise
    popular: false,
  },
];

/**
 * Get all credit plans
 * GET /api/payment/plans
 */
export const getPlans = async (req, res) => {
  try {
    queueLogger.info("[PAYMENT] Fetching credit plans");

    return res.status(200).json({
      success: true,
      plans: CREDIT_PLANS,
    });
  } catch (error) {
    queueLogger.error(`[PAYMENT] Error fetching plans: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch credit plans",
      error: error.message,
    });
  }
};

/**
 * Create Razorpay Order
 * POST /api/payment/create-order
 * Body: { planId }
 */
export const createPaymentOrder = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.user.id;

    // Validate plan
    const plan = CREDIT_PLANS.find((p) => p.id === planId);
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan selected",
      });
    }

    queueLogger.info(
      `[PAYMENT] Creating order - User: ${userId}, Plan: ${plan.name}`
    );

    // Create Razorpay order (receipt max 40 chars)
    const receipt = `rcpt_${Date.now()}`;
    const notes = {
      userId: userId.toString(),
      planId: plan.id,
      planName: plan.name,
      credits: plan.credits,
    };

    const razorpayOrder = await createOrder(plan.amount, "INR", receipt, notes);

    // Save payment record
    const payment = new Payment({
      userId,
      razorpayOrderId: razorpayOrder.id,
      planId: plan.id,
      planName: plan.name,
      creditsAmount: plan.credits,
      amount: plan.amount,
      currency: "INR",
      status: "created",
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    await payment.save();

    queueLogger.info(
      `[PAYMENT] ✅ Order created - OrderID: ${razorpayOrder.id}, PaymentID: ${payment._id}`
    );

    return res.status(201).json({
      success: true,
      message: "Payment order created successfully",
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        paymentId: payment._id.toString(),
      },
      plan: {
        name: plan.name,
        credits: plan.credits,
        price: plan.price,
      },
      key: process.env.RAZORPAY_KEY_ID, // Frontend needs this for Razorpay SDK
    });
  } catch (error) {
    queueLogger.error(`[PAYMENT] Order creation failed: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      error: error.message,
    });
  }
};

/**
 * Verify Payment and Add Credits
 * POST /api/payment/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
export const verifyPayment = async (req, res) => {
  // Disable sessions completely for standalone MongoDB
  const useSession = false;
  const session = null;

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;
    const userId = req.user.id;
    const payment = req.payment; // Attached by verifyPaymentOwnership middleware

    queueLogger.info(
      `[PAYMENT] Verifying payment - OrderID: ${razorpay_order_id}, PaymentID: ${razorpay_payment_id}`
    );

    // Verify signature
    const isValid = verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      payment.status = "failed";
      payment.failureReason = "Invalid payment signature";
      if (useSession) {
        await payment.save({ session });
      } else {
        await payment.save();
      }
      if (useSession) await session.commitTransaction();

      queueLogger.error(
        `[PAYMENT] ❌ Invalid signature - PaymentID: ${payment._id}`
      );

      return res.status(400).json({
        success: false,
        message: "Payment verification failed - invalid signature",
      });
    }

    // Fetch payment details from Razorpay
    const razorpayPayment = await fetchPayment(razorpay_payment_id);

    // Update payment record
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status =
      razorpayPayment.status === "captured" ? "success" : "pending";
    payment.paymentMethod = razorpayPayment.method || "unknown";

    // Add card details if card payment
    if (razorpayPayment.card) {
      payment.cardDetails = {
        last4: razorpayPayment.card.last4,
        network: razorpayPayment.card.network,
        type: razorpayPayment.card.type,
      };
    }

    if (useSession) {
      await payment.save({ session });
    } else {
      await payment.save();
    }

    // Add credits if payment successful
    if (payment.status === "success") {
      queueLogger.info(
        `[PAYMENT] 💰 Adding credits - User: ${userId}, Credits: ${payment.creditsAmount}`
      );

      const user = useSession
        ? await User.findById(userId).session(session)
        : await User.findById(userId);

      // Add credits using atomic transaction
      await addCreditsFromPayment(
        userId,
        payment.creditsAmount,
        payment._id,
        `Credit purchase - ${payment.planName}`,
        useSession ? session : null
      );

      // Update user payment history
      user.paymentHistory.push(payment._id);
      user.totalSpent = (user.totalSpent || 0) + payment.amount / 100; // Convert paise to rupees
      user.lifetimeCredits =
        (user.lifetimeCredits || 0) + payment.creditsAmount;
      if (useSession) {
        await user.save({ session });
      } else {
        await user.save();
      }

      // Mark credits as added
      payment.creditsAdded = true;
      payment.creditsAddedAt = new Date();
      if (useSession) {
        await payment.save({ session });
      } else {
        await payment.save();
      }

      if (useSession) await session.commitTransaction();

      queueLogger.info(
        `[PAYMENT] ✅ Payment successful - User: ${userId}, Credits added: ${payment.creditsAmount}`
      );

      // Send success email (async, don't wait)
      sendPaymentSuccessEmail(user.email, {
        username: user.username,
        planName: payment.planName,
        creditsAmount: payment.creditsAmount,
        amount: payment.amount,
        paymentId: razorpay_payment_id,
        transactionDate: payment.createdAt,
      }).catch((err) =>
        queueLogger.error(
          `[EMAIL] Failed to send success email: ${err.message}`
        )
      );

      return res.status(200).json({
        success: true,
        message: "Payment verified and credits added successfully",
        credits: payment.creditsAmount,
        payment: {
          id: payment._id.toString(),
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          amount: payment.amount / 100, // Convert to rupees
          status: payment.status,
        },
      });
    } else {
      if (useSession) await session.commitTransaction();

      queueLogger.warn(
        `[PAYMENT] Payment not captured - Status: ${payment.status}`
      );

      return res.status(400).json({
        success: false,
        message: "Payment not completed",
        status: payment.status,
      });
    }
  } catch (error) {
    if (useSession && session) await session.abortTransaction();
    queueLogger.error(`[PAYMENT] Verification error: ${error.message}`, error);

    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message,
    });
  } finally {
    if (session) session.endSession();
  }
};

/**
 * Handle Razorpay Webhooks
 * POST /api/payment/webhook
 */
export const handleWebhook = async (req, res) => {
  try {
    const event = req.body.event;
    const payload = req.body.payload.payment.entity;

    queueLogger.info(`[WEBHOOK] 📨 Received event: ${event}`);

    // Handle different webhook events
    switch (event) {
      case "payment.captured": {
        const { order_id, id: payment_id } = payload;

        // Find payment by order ID
        const payment = await Payment.findOne({ razorpayOrderId: order_id });

        if (!payment) {
          queueLogger.warn(
            `[WEBHOOK] Payment not found for order: ${order_id}`
          );
          return res
            .status(404)
            .json({ success: false, message: "Payment not found" });
        }

        // Skip if already processed
        if (payment.creditsAdded) {
          queueLogger.info(
            `[WEBHOOK] Credits already added for payment: ${payment._id}`
          );
          return res
            .status(200)
            .json({ success: true, message: "Already processed" });
        }

        // Disable sessions for standalone MongoDB
        const useSession = false;
        const session = null;

        try {
          // Update payment
          payment.razorpayPaymentId = payment_id;
          payment.status = "success";
          payment.paymentMethod = payload.method;

          if (payload.card) {
            payment.cardDetails = {
              last4: payload.card.last4,
              network: payload.card.network,
              type: payload.card.type,
            };
          }

          if (useSession) {
            await payment.save({ session });
          } else {
            await payment.save();
          }

          // Add credits
          await addCreditsFromPayment(
            payment.userId,
            payment.creditsAmount,
            payment._id,
            `Credit purchase - ${payment.planName}`,
            useSession ? session : null
          );

          // Update user
          const user = useSession
            ? await User.findById(payment.userId).session(session)
            : await User.findById(payment.userId);

          if (!user.paymentHistory.includes(payment._id)) {
            user.paymentHistory.push(payment._id);
          }
          user.totalSpent = (user.totalSpent || 0) + payment.amount / 100;
          user.lifetimeCredits =
            (user.lifetimeCredits || 0) + payment.creditsAmount;
          if (useSession) {
            await user.save({ session });
          } else {
            await user.save();
          }

          // Mark credits as added
          payment.creditsAdded = true;
          payment.creditsAddedAt = new Date();
          if (useSession) {
            await payment.save({ session });
          } else {
            await payment.save();
          }

          if (useSession) await session.commitTransaction();

          queueLogger.info(
            `[WEBHOOK] ✅ Credits added via webhook - User: ${payment.userId}, Credits: ${payment.creditsAmount}`
          );

          // Send success email
          sendPaymentSuccessEmail(user.email, {
            username: user.username,
            planName: payment.planName,
            creditsAmount: payment.creditsAmount,
            amount: payment.amount,
            paymentId: payment_id,
            transactionDate: payment.createdAt,
          }).catch((err) =>
            queueLogger.error(`[EMAIL] Webhook email failed: ${err.message}`)
          );
        } catch (error) {
          if (useSession && session) await session.abortTransaction();
          throw error;
        } finally {
          if (session) session.endSession();
        }

        break;
      }

      case "payment.failed": {
        const { order_id, error_description } = payload;

        const payment = await Payment.findOne({ razorpayOrderId: order_id });

        if (payment) {
          payment.status = "failed";
          payment.failureReason = error_description || "Payment failed";
          await payment.save();

          queueLogger.error(
            `[WEBHOOK] ❌ Payment failed - Order: ${order_id}, Reason: ${error_description}`
          );

          // Send failure email
          const user = await User.findById(payment.userId);
          if (user) {
            sendPaymentFailedEmail(user.email, {
              username: user.username,
              planName: payment.planName,
              amount: payment.amount,
              failureReason: error_description,
              attemptDate: payment.createdAt,
            }).catch((err) =>
              queueLogger.error(`[EMAIL] Failure email failed: ${err.message}`)
            );
          }
        }

        break;
      }

      default:
        queueLogger.info(`[WEBHOOK] Unhandled event: ${event}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    queueLogger.error(
      `[WEBHOOK] Error processing webhook: ${error.message}`,
      error
    );
    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
      error: error.message,
    });
  }
};

/**
 * Get Payment History
 * GET /api/payment/history?page=1&limit=10
 */
export const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    queueLogger.info(
      `[PAYMENT] Fetching history - User: ${userId}, Page: ${page}`
    );

    const [payments, total] = await Promise.all([
      Payment.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-razorpaySignature -metadata -__v"),
      Payment.countDocuments({ userId }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      payments: payments.map((p) => ({
        id: p._id.toString(),
        planName: p.planName,
        credits: p.creditsAmount,
        amount: p.amount / 100, // Convert to rupees
        status: p.status,
        paymentMethod: p.paymentMethod,
        orderId: p.razorpayOrderId,
        paymentId: p.razorpayPaymentId,
        date: p.createdAt,
        creditsAdded: p.creditsAdded,
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalPayments: total,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    queueLogger.error(`[PAYMENT] History fetch error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
      error: error.message,
    });
  }
};

/**
 * Retry Failed Payment
 * POST /api/payment/retry
 * Body: { paymentId }
 */
export const retryPayment = async (req, res) => {
  try {
    const { paymentId } = req.body;
    const userId = req.user.id;

    const oldPayment = await Payment.findOne({ _id: paymentId, userId });

    if (!oldPayment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (oldPayment.status === "success") {
      return res.status(400).json({
        success: false,
        message: "Payment already successful",
      });
    }

    queueLogger.info(`[PAYMENT] Retrying payment - Original: ${paymentId}`);

    // Find plan
    const plan = CREDIT_PLANS.find((p) => p.id === oldPayment.planId);
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Plan no longer available",
      });
    }

    // Create new order
    const receipt = `retry_${Date.now()}`;
    const notes = {
      userId: userId.toString(),
      planId: plan.id,
      planName: plan.name,
      credits: plan.credits,
      retryOf: paymentId,
    };

    const razorpayOrder = await createOrder(plan.amount, "INR", receipt, notes);

    // Create new payment record
    const newPayment = new Payment({
      userId,
      razorpayOrderId: razorpayOrder.id,
      planId: plan.id,
      planName: plan.name,
      creditsAmount: plan.credits,
      amount: plan.amount,
      currency: "INR",
      status: "created",
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        retryOf: paymentId,
        attemptCount: (oldPayment.metadata?.attemptCount || 0) + 1,
      },
    });

    await newPayment.save();

    queueLogger.info(
      `[PAYMENT] ✅ Retry order created - New OrderID: ${razorpayOrder.id}`
    );

    return res.status(201).json({
      success: true,
      message: "New payment order created for retry",
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        paymentId: newPayment._id.toString(),
      },
      plan: {
        name: plan.name,
        credits: plan.credits,
        price: plan.price,
      },
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    queueLogger.error(`[PAYMENT] Retry error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Failed to retry payment",
      error: error.message,
    });
  }
};

/**
 * Refund Payment (Admin Only)
 * POST /api/payment/refund
 * Body: { paymentId, reason }
 */
export const refundPayment = async (req, res) => {
  // Disable sessions for standalone MongoDB
  const useSession = false;
  const session = null;

  try {
    const { paymentId, reason } = req.body;

    const payment = useSession
      ? await Payment.findById(paymentId).session(session)
      : await Payment.findById(paymentId);

    if (!payment) {
      if (useSession) await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.status !== "success") {
      if (useSession) await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Only successful payments can be refunded",
      });
    }

    if (payment.refund.status === "refunded") {
      if (useSession) await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Payment already refunded",
      });
    }

    queueLogger.info(`[PAYMENT] Processing refund - PaymentID: ${paymentId}`);

    // Create refund in Razorpay
    const refundData = await createRefund(
      payment.razorpayPaymentId,
      payment.amount,
      {
        reason: reason || "Requested by admin",
      }
    );

    // Update payment record
    payment.status = "refunded";
    payment.refund = {
      razorpayRefundId: refundData.id,
      amount: payment.amount,
      status: "refunded",
      reason: reason || "Requested by admin",
      initiatedAt: new Date(),
      processedAt: new Date(),
    };

    if (useSession) {
      await payment.save({ session });
    } else {
      await payment.save();
    }

    // Deduct credits if they were added
    if (payment.creditsAdded) {
      const user = useSession
        ? await User.findById(payment.userId).session(session)
        : await User.findById(payment.userId);

      // Check if user has enough credits
      if (user.credits < payment.creditsAmount) {
        if (useSession) await session.abortTransaction();
        queueLogger.warn(
          `[PAYMENT] Insufficient credits for refund - User: ${user._id}`
        );
        return res.status(400).json({
          success: false,
          message: "User doesn't have enough credits to refund",
        });
      }

      // Deduct credits
      user.credits -= payment.creditsAmount;
      user.totalSpent = Math.max(
        0,
        (user.totalSpent || 0) - payment.amount / 100
      );
      if (useSession) {
        await user.save({ session });
      } else {
        await user.save();
      }

      queueLogger.info(
        `[PAYMENT] Credits deducted for refund - User: ${user._id}, Credits: ${payment.creditsAmount}`
      );
    }

    if (useSession) await session.commitTransaction();

    queueLogger.info(
      `[PAYMENT] ✅ Refund processed - PaymentID: ${paymentId}, RefundID: ${refundData.id}`
    );

    return res.status(200).json({
      success: true,
      message: "Payment refunded successfully",
      refund: {
        id: refundData.id,
        amount: payment.amount / 100,
        status: "refunded",
      },
    });
  } catch (error) {
    if (useSession && session) await session.abortTransaction();
    queueLogger.error(`[PAYMENT] Refund error: ${error.message}`, error);

    return res.status(500).json({
      success: false,
      message: "Failed to process refund",
      error: error.message,
    });
  } finally {
    if (session) session.endSession();
  }
};

export default {
  getPlans,
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  getPaymentHistory,
  retryPayment,
  refundPayment,
};
