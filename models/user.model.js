import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: function () {
        return this.accountStatus === "active";
      },
    },
    userType: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    organizationName: {
      type: String,
    },
    reasonForJoining: {
      type: String,
    },
    accountStatus: {
      type: String,
      enum: ["pending", "active", "inactive"],
      default: "active",
    },
    credits: {
      total: { type: Number, default: 0 },
      used: { type: Number, default: 0 },
      remaining: { type: Number, default: 0 },
    },
    tier: {
      type: String,
      enum: ["tier1", "tier2"],
      default: null,
    },
    tierInfo: {
      name: String,
      monthlyCredits: Number,
      pricePerYear: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Payment History
    paymentHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
      },
    ],
    totalSpent: {
      type: Number,
      default: 0,
    },
    lifetimeCredits: {
      type: Number,
      default: 0,
    },
    // Payment History
    paymentHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
      },
    ],
    totalSpent: {
      type: Number,
      default: 0,
    },
    lifetimeCredits: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
