/**
 * Dynamic Credit Calculator
 * Calculates credits based on file size and processing time
 */

/**
 * Calculate credits based on size and time (Phase 1)
 * @param {Number} fileSize - File size in bytes
 * @param {Number} processingTime - Processing time in seconds
 * @returns {Object} Credit calculation result
 */
export function calculateDynamicCredits(fileSize, processingTime) {
  // 1. Base credits from file size
  const baseCredits = getBaseCreditsBySize(fileSize);

  // 2. Time-based credits
  const timeCredits = getTimePenalty(processingTime);

  // 3. Total (no complexity for now - Phase 2)
  const total = baseCredits + timeCredits;

  return {
    total: Math.ceil(total),
    breakdown: {
      baseCredits,
      timeCredits,
      complexityCredits: 0, // Reserved for Phase 2
    },
  };
}

/**
 * Get base credits by file size (in bytes)
 * Higher baseline for sustainable pricing
 */
function getBaseCreditsBySize(sizeInBytes) {
  const sizeInMB = sizeInBytes / (1024 * 1024);

  if (sizeInMB < 0.5) return 2; // < 500 KB: 2 credits
  if (sizeInMB < 5) return 5; // 500 KB - 5 MB: 5 credits
  if (sizeInMB < 20) return 10; // 5 MB - 20 MB: 10 credits
  if (sizeInMB < 50) return 20; // 20 MB - 50 MB: 20 credits
  return 35; // 50 MB - 80 MB: 35 credits
}

/**
 * Get time penalty credits (in seconds)
 * Reflects actual server/LLM resource consumption
 */
function getTimePenalty(timeInSeconds) {
  if (timeInSeconds < 10) return 0; // < 10s: Free (fast)
  if (timeInSeconds < 30) return 3; // 10-30s: 3 credits
  if (timeInSeconds < 60) return 7; // 30-60s: 7 credits
  if (timeInSeconds < 120) return 15; // 60-120s: 15 credits
  return 25; // > 120s: 25 credits (max)
}

/**
 * Get human-readable size tier
 * @param {Number} sizeInBytes - File size in bytes
 * @returns {String} Size tier name
 */
export function getSizeTier(sizeInBytes) {
  const sizeInMB = sizeInBytes / (1024 * 1024);

  if (sizeInMB < 0.5) return "tiny";
  if (sizeInMB < 5) return "small";
  if (sizeInMB < 20) return "medium";
  if (sizeInMB < 50) return "large";
  return "huge";
}

/**
 * Get human-readable time tier
 * @param {Number} timeInSeconds - Processing time in seconds
 * @returns {String} Time tier name
 */
export function getTimeTier(timeInSeconds) {
  if (timeInSeconds < 10) return "quick";
  if (timeInSeconds < 30) return "normal";
  if (timeInSeconds < 60) return "slow";
  if (timeInSeconds < 120) return "heavy";
  return "extreme";
}

/**
 * Format credit breakdown for logging/debugging
 * @param {Object} breakdown - Credit breakdown object
 * @returns {String} Formatted string
 */
export function formatCreditBreakdown(breakdown) {
  return `Total: ${breakdown.total} (Base: ${breakdown.baseCredits}, Time: ${breakdown.timeCredits})`;
}
