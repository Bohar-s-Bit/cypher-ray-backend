import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import redisClient from "../config/redis.js";
import { sdkLogger } from "../utils/logger.js";

/**
 * Create rate limiter based on user tier
 */
const createTierRateLimiter = () => {
  const tierLimits = {
    tier1: { windowMs: 60 * 60 * 1000, max: 1000 }, // 1000 req/hour
    tier2: { windowMs: 60 * 60 * 1000, max: 100 }, // 100 req/hour
  };

  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: async (req) => {
      const userTier = req.user?.tier || "tier2";
      const limits = tierLimits[userTier] || tierLimits.tier2;
      return limits.max;
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req) => {
      // Use API key ID for rate limiting
      return `sdk-ratelimit:${req.apiKey._id}`;
    },
    handler: (req, res) => {
      const userTier = req.user?.tier || "tier2";
      const limits = tierLimits[userTier];

      sdkLogger.warn("Rate limit exceeded", {
        userId: req.user._id.toString(),
        apiKeyId: req.apiKey._id.toString(),
        tier: userTier,
        limit: limits.max,
        endpoint: req.path,
      });

      res.status(429).json({
        success: false,
        message: "Rate limit exceeded",
        code: "RATE_LIMIT_EXCEEDED",
        details: {
          tier: userTier,
          limit: limits.max,
          windowMs: limits.windowMs,
          retryAfter: res.getHeader("Retry-After"),
          upgradeUrl: `${process.env.FRONTEND_URL}/upgrade`,
        },
      });
    },
    // Use Redis store for distributed rate limiting
    store: new RedisStore({
      // @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
      sendCommand: (...args) => redisClient.call(...args),
    }),
  });
};

/**
 * Burst rate limiter - prevent spam requests
 */
export const burstRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Max 30 requests per minute
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sdkLogger.warn("Burst rate limit exceeded", {
      ip: req.ip,
      endpoint: req.path,
    });

    res.status(429).json({
      success: false,
      message: "Too many requests - please slow down",
      code: "BURST_LIMIT_EXCEEDED",
      details: {
        retryAfter: res.getHeader("Retry-After"),
      },
    });
  },
  store: new RedisStore({
    // @ts-expect-error - Known issue
    sendCommand: (...args) => redisClient.call(...args),
  }),
});

export const sdkRateLimiter = createTierRateLimiter();

export default { sdkRateLimiter, burstRateLimiter };
