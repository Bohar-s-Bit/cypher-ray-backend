import { body, param, query, validationResult } from "express-validator";

/**
 * Validation middleware to check for errors
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

/**
 * Login validation
 */
export const loginValidation = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
  validate,
];

/**
 * Create user validation
 */
export const createUserValidation = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
  body("organizationName")
    .trim()
    .notEmpty()
    .withMessage("Organization name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Organization name must be between 2 and 100 characters"),
  body("userType")
    .optional()
    .isIn(["user"])
    .withMessage("Invalid user type. Must be 'user'"),
  body("tier")
    .notEmpty()
    .withMessage("Tier is required")
    .isIn(["tier1", "tier2"])
    .withMessage("Invalid tier. Must be tier1 or tier2"),
  validate,
];

/**
 * Update credits validation
 */
export const updateCreditsValidation = [
  param("userId").isMongoId().withMessage("Invalid user ID"),
  body("credits")
    .isInt({ min: 0 })
    .withMessage("Credits must be a positive number"),
  body("action")
    .isIn(["add", "set"])
    .withMessage('Action must be either "add" or "set"'),
  validate,
];

/**
 * User ID param validation
 */
export const userIdValidation = [
  param("userId").isMongoId().withMessage("Invalid user ID"),
  validate,
];

/**
 * Update status validation
 */
export const updateStatusValidation = [
  param("userId").isMongoId().withMessage("Invalid user ID"),
  body("isActive").isBoolean().withMessage("isActive must be a boolean"),
  validate,
];

/**
 * Change password validation
 */
export const changePasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  validate,
];

/**
 * Update profile validation
 */
export const updateProfileValidation = [
  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),
  body("organizationName")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Organization name must be between 2 and 100 characters"),
  validate,
];

/**
 * Query pagination validation
 */
export const paginationValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  validate,
];
