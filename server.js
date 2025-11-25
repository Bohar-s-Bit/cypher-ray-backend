import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

// Database connection
import database from "./db/db.js";

// Redis and Queue initialization
import "./config/redis.js";
import "./config/queue.js";
import "./services/queue.worker.js"; // Initialize queue workers
import { startCleanupService } from "./services/cloudinary.cleanup.js"; // Cloudinary cleanup

// Routes
import userRoutes from "./routes/user.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import sdkRoutes from "./routes/sdk.routes.js";
import paymentRoutes from "./routes/payment.routes.js";

// Logger
import logger from "./utils/logger.js";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Trust proxy - required for Render, Railway, and other reverse proxies
app.set("trust proxy", 1);

// Connect to the database
database.connect();

// Initialize Socket.IO
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
});

io.on("connection", (socket) => {
  logger.info("Client connected to WebSocket", { socketId: socket.id });

  socket.on("subscribe-job", (jobId) => {
    socket.join(`job:${jobId}`);
    logger.info("Client subscribed to job", { jobId, socketId: socket.id });
  });

  socket.on("subscribe-user", (userId) => {
    socket.join(`user:${userId}`);
    logger.info("Client subscribed to user", { userId, socketId: socket.id });
  });

  socket.on("disconnect", () => {
    logger.info("Client disconnected", { socketId: socket.id });
  });
});

/**
 * Middleware
 */

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from assets folder (for email logo)
app.use("/assets", express.static("assets"));

// Request logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for internal job status polling routes
    return req.path.match(/^\/api\/user\/analyze\/[a-f0-9]{24}$/i);
  },
});

app.use("/api/", limiter);

/**
 * Routes
 */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Cypher-Ray API is running",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint for CI/CD and monitoring
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// API Routes
app.use("/api/auth", userRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/sdk", sdkRoutes); // SDK API routes
app.use("/api/payment", paymentRoutes); // Payment API routes

/**
 * Error Handling
 */

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error("Global error handler", {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    error: process.env.NODE_ENV === "development" ? err : undefined,
  });
});

/**
 * Start Server
 */

httpServer.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `🔐 CORS enabled for: ${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }`
  );
  console.log(`🔌 WebSocket server ready`);
  console.log(`🧹 Cloudinary cleanup service starting...`);

  // Start Cloudinary cleanup service (runs daily at 2 AM)
  startCleanupService();

  logger.info("Server started successfully", {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  httpServer.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});
