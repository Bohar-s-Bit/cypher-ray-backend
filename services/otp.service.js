import OTP from "../models/otp.model.js";
import { sendPasswordChangeOTP } from "../utils/send.email.js";

/**
 * Generate 6-digit OTP
 * @returns {String} 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Create and send OTP for password change
 * @param {String} userId - User ID
 * @param {String} email - User email
 * @param {String} username - Username
 * @returns {Object} OTP creation result
 */
export const createPasswordChangeOTP = async (userId, email, username) => {
  try {
    // Generate 6-digit OTP
    const otp = generateOTP();

    // Set expiry time (2 minutes from now)
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    // Create OTP record
    await OTP.create({
      userId,
      otp,
      purpose: "password_change",
      used: false,
      expiresAt,
    });

    // Send OTP email
    const emailResult = await sendPasswordChangeOTP({
      email,
      username,
      otp,
    });

    if (!emailResult.success) {
      throw new Error("Failed to send OTP email");
    }

    console.log(`✅ OTP created and sent for user: ${userId}`);

    return {
      success: true,
      message: "OTP sent to your email",
      expiresIn: "2 minutes",
    };
  } catch (error) {
    console.error("❌ Error creating OTP:", error.message);
    throw new Error(`Failed to create OTP: ${error.message}`);
  }
};

/**
 * Verify OTP for password change
 * @param {String} userId - User ID
 * @param {String} otp - OTP code
 * @returns {Object} Verification result
 */
export const verifyPasswordChangeOTP = async (userId, otp) => {
  try {
    // Find OTP record
    const otpRecord = await OTP.findOne({
      userId,
      otp,
      purpose: "password_change",
      used: false,
    });

    if (!otpRecord) {
      return {
        success: false,
        message: "Invalid OTP code",
      };
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      return {
        success: false,
        message: "OTP has expired. Please request a new password change.",
      };
    }

    // Mark OTP as used
    otpRecord.used = true;
    await otpRecord.save();

    console.log(`✅ OTP verified successfully for user: ${userId}`);

    return {
      success: true,
      message: "OTP verified successfully",
    };
  } catch (error) {
    console.error("❌ Error verifying OTP:", error.message);
    throw new Error(`Failed to verify OTP: ${error.message}`);
  }
};
