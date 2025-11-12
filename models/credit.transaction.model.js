import mongoose from "mongoose";

const creditTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["credit", "debit", "bonus", "refund"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
    },
    jobId: {
      type: String,
    },
    balanceBefore: {
      type: Number,
    },
    balanceAfter: {
      type: Number,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for faster queries
creditTransactionSchema.index({ userId: 1, createdAt: -1 });

const CreditTransaction = mongoose.model(
  "CreditTransaction",
  creditTransactionSchema
);
export default CreditTransaction;
