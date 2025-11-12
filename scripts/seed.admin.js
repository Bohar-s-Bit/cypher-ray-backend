import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";

dotenv.config();

/**
 * Seed script to create initial admin user
 * Run: node scripts/seed.admin.js
 */

const seedAdmin = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("📡 Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: "admin@cypherray.com" });

    if (existingAdmin) {
      console.log("⚠️  Admin user already exists");
      console.log("Email:", existingAdmin.email);
      console.log("Username:", existingAdmin.username);
      await mongoose.disconnect();
      return;
    }

    // Create admin user
    const adminPassword = "Admin@123"; // Change this password after first login

    const admin = await User.create({
      username: "admin",
      email: "admin@cypherray.com",
      password: adminPassword, // Will be hashed by pre-save hook
      userType: "admin",
      organizationName: "Cypher-Ray Administration",
      credits: {
        total: 999999,
        used: 0,
        remaining: 999999,
      },
      tier: null, // Admin doesn't need a tier
      tierInfo: {
        name: "Admin",
        monthlyCredits: 999999,
        pricePerYear: 0,
      },
      isActive: true,
    });

    console.log("✅ Admin user created successfully!");
    console.log("");
    console.log("═══════════════════════════════════════");
    console.log("Admin Credentials:");
    console.log("═══════════════════════════════════════");
    console.log("Email:    ", admin.email);
    console.log("Username: ", admin.username);
    console.log("Password: ", adminPassword);
    console.log("═══════════════════════════════════════");
    console.log("");
    console.log("⚠️  IMPORTANT: Change this password after first login!");
    console.log("");

    await mongoose.disconnect();
    console.log("📴 Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the seed function
seedAdmin();
