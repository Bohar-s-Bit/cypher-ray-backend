import mongoose from "mongoose";

/**
 * MongoDB Database Connection Configuration
 * Handles connection establishment, error handling, and graceful shutdown
 */

class Database {
  constructor() {
    this.connection = null;
  }

  /**
   * Connect to MongoDB with retry logic
   */
  async connect() {
    try {
      const options = {
        maxPoolSize: 10, // Connection pooling
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      };

      this.connection = await mongoose.connect(
        process.env.MONGODB_URI,
        options
      );

      console.log(`✅ MongoDB Connected: ${this.connection.connection.host}`);

      // Connection event listeners
      mongoose.connection.on("connected", () => {
        console.log("📡 Mongoose connected to MongoDB");
      });

      mongoose.connection.on("error", (err) => {
        console.error("❌ Mongoose connection error:", err);
      });

      mongoose.connection.on("disconnected", () => {
        console.log("📴 Mongoose disconnected");
      });

      // Graceful shutdown
      process.on("SIGINT", async () => {
        await this.disconnect();
        process.exit(0);
      });
    } catch (error) {
      console.error("❌ MongoDB connection failed:", error.message);
      // Retry after 5 seconds
      setTimeout(() => this.connect(), 5000);
    }
  }

  /**
   * Close database connection gracefully
   */
  async disconnect() {
    if (this.connection) {
      await mongoose.connection.close();
      console.log("✅ MongoDB connection closed gracefully");
    }
  }
}

export default new Database();
