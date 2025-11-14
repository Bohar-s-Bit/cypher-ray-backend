import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "cypherray-backend" },
  transports: [
    // Console transport (always works in serverless)
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

// Only add file transports if not in serverless environment (Vercel)
if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 30,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/error.log"),
      level: "error",
      maxsize: 5242880,
      maxFiles: 30,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/sdk.log"),
      maxsize: 5242880,
      maxFiles: 30,
      format: winston.format.combine(
        winston.format((info) => (info.context === "sdk" ? info : false))(),
        logFormat
      ),
    })
  );
  logger.add(
    new winston.transports.File({
      filename: path.join(__dirname, "../logs/queue.log"),
      maxsize: 5242880,
      maxFiles: 30,
      format: winston.format.combine(
        winston.format((info) => (info.context === "queue" ? info : false))(),
        logFormat
      ),
    })
  );
}

// Create specific loggers for different contexts
export const sdkLogger = {
  info: (message, meta = {}) =>
    logger.info(message, { ...meta, context: "sdk" }),
  error: (message, meta = {}) =>
    logger.error(message, { ...meta, context: "sdk" }),
  warn: (message, meta = {}) =>
    logger.warn(message, { ...meta, context: "sdk" }),
  debug: (message, meta = {}) =>
    logger.debug(message, { ...meta, context: "sdk" }),
};

export const queueLogger = {
  info: (message, meta = {}) =>
    logger.info(message, { ...meta, context: "queue" }),
  error: (message, meta = {}) =>
    logger.error(message, { ...meta, context: "queue" }),
  warn: (message, meta = {}) =>
    logger.warn(message, { ...meta, context: "queue" }),
  debug: (message, meta = {}) =>
    logger.debug(message, { ...meta, context: "queue" }),
};

export default logger;
