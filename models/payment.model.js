import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    // User Information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Razorpay IDs
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      index: true,
    },
    razorpaySignature: {
      type: String,
    },

    // Plan Details
    planId: {
      type: String,
      required: true,
    },
    planName: {
      type: String,
      required: true,
    },
    creditsAmount: {
      type: Number,
      required: true,
    },

    // Payment Details
    amount: {
      type: Number,
      required: true, // In paise (₹100 = 10000 paise)
    },
    currency: {
      type: String,
      default: "INR",
    },

    // Status Tracking
    status: {
      type: String,
      enum: ["created", "pending", "success", "failed", "refunded"],
      default: "created",
      index: true,
    },

    // Payment Method Details (filled after payment)
    paymentMethod: String, // card, netbanking, upi, wallet
    cardDetails: {
      last4: String,
      network: String, // visa, mastercard, etc.
      type: String, // credit, debit
    },

    // Credits Management
    creditsAdded: {
      type: Boolean,
      default: false,
    },
    creditTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreditTransaction",
    },

    // Metadata
    metadata: {
      ipAddress: String,
      userAgent: String,
      attemptCount: {
        type: Number,
        default: 1,
      },
    },

    // Failure Details
    failureReason: String,

    // Refund Details (if applicable)
    refundId: String,
    refundAmount: Number,
    refundReason: String,
    refundedAt: Date,

    // Timestamps
    paidAt: Date,
  },
  { timestamps: true }
);

// Indexes for common queries
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ createdAt: -1 });

const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;
