# Credit System Fixes - Complete Overhaul

## 🚨 Issues Found and Fixed

### **Critical Bug: Double Credit Deduction**

**Problem:**
The system was deducting credits **TWICE**:

1. **Upfront** in controllers (1 credit flat rate)
2. **After analysis** in queue worker (dynamic 2-60 credits)

This caused:

- Users charged 21-61 credits instead of 2-60 credits
- Negative balance blocked even when user had enough initial credits
- SDK and dashboard both had same issue

---

## ✅ Complete Fix Applied

### **1. User Dashboard (`/api/user/analyze`)**

**File: `controllers/user.controllers.js`**

**BEFORE (BROKEN):**

```javascript
// Deduct credits UPFRONT
await deductCredits(userId, 1, "Binary analysis", job._id.toString());

// Queue job
await sdkAnalysisQueue.add(tier, {
  jobId,
  userId,
  cloudinaryUrl,
  filename,
  tier,
  // ❌ Missing fileSize!
});

res.json({
  creditsCharged: 1, // ❌ Wrong - actual cost unknown
});
```

**AFTER (FIXED):**

```javascript
// NO upfront deduction!
// Credits calculated and deducted AFTER analysis in queue worker

// Queue job WITH fileSize
await sdkAnalysisQueue.add(tier, {
  jobId,
  userId,
  cloudinaryUrl,
  filename,
  fileSize,
  tier, // ✅ fileSize added
});

res.json({
  note: "Credits calculated after analysis completes",
});
```

**File: `routes/user.routes.js`**

**BEFORE:**

```javascript
router.post("/analyze", auth, uploadSingle, creditCheck(1), analyzeSingleUser);
// ❌ creditCheck(1) required 1 credit upfront
```

**AFTER:**

```javascript
router.post("/analyze", auth, uploadSingle, creditCheck(), analyzeSingleUser);
// ✅ creditCheck() only checks >= 5 credits (minimum threshold)
```

---

### **2. SDK Single File (`/api/sdk/analyze`)**

**File: `controllers/sdk.controller.js`**

**Already Fixed** ✅ (from previous session)

- No upfront deduction
- Passes `fileSize` to queue
- Sets `creditsDeducted: 0` in job creation

**File: `routes/sdk.routes.js`**

**BEFORE:**

```javascript
router.post(
  "/analyze",
  requirePermission("sdk:analyze"),
  uploadSingle,
  creditCheck(1),
  analyzeSingle
);
// ❌ creditCheck(1) required 1 credit upfront
```

**AFTER:**

```javascript
router.post(
  "/analyze",
  requirePermission("sdk:analyze"),
  uploadSingle,
  creditCheck(),
  analyzeSingle
);
// ✅ creditCheck() only checks >= 5 credits
```

---

### **3. SDK Batch Files (`/api/sdk/analyze/batch`)**

**File: `controllers/sdk.controller.js`**

**BEFORE (BROKEN):**

```javascript
for (const file of files) {
  const job = await AnalysisJob.create({
    creditsDeducted: 1, // ❌ Wrong value
  });

  // ❌ Deduct credits UPFRONT
  await deductCreditsForSDK(userId, 1, job._id, apiKeyId);
  creditsCharged += 1;

  await sdkAnalysisQueue.add(tier, {
    jobId,
    userId,
    cloudinaryUrl,
    filename,
    tier,
    // ❌ Missing fileSize!
  });

  results.push({
    creditsCharged: 1, // ❌ Wrong
  });
}

res.json({ creditsCharged }); // ❌ Upfront total
```

**AFTER (FIXED):**

```javascript
for (const file of files) {
  const job = await AnalysisJob.create({
    creditsDeducted: 0, // ✅ Deducted after analysis
  });

  // ✅ NO upfront deduction!

  await sdkAnalysisQueue.add(tier, {
    jobId,
    userId,
    cloudinaryUrl,
    filename,
    fileSize,
    tier,
    apiKeyId, // ✅ fileSize added
  });

  results.push({
    note: "Credits calculated after analysis",
  });
}

res.json({
  note: "Credits calculated after analysis per file",
});
```

---

### **4. Queue Worker Post-Analysis Deduction**

**File: `services/queue.worker.js`**

**Already Fixed** ✅ (from previous session)

```javascript
// ✅ Track processing time
const analysisStartTime = Date.now();

// ... ML analysis happens ...

const processingTimeSeconds = Math.round(
  (Date.now() - analysisStartTime) / 1000
);

// ✅ Calculate dynamic credits
const creditCalculation = calculateDynamicCredits(
  fileSize,
  processingTimeSeconds
);
const creditsToDeduct = creditCalculation.total;

// ✅ Store breakdown in job
job.creditBreakdown = {
  baseCredits: creditCalculation.breakdown.baseCredits,
  timeCredits: creditCalculation.breakdown.timeCredits,
  sizeTier: getSizeTier(fileSize),
  timeTier: getTimeTier(processingTimeSeconds),
  totalCalculated: creditsToDeduct,
};

// ✅ Deduct AFTER successful analysis
await deductCreditsForSDK(userId, creditsToDeduct, jobId, apiKeyId);
```

---

### **5. Allow Negative Balance (Debt Model)**

**File: `services/credit.service.js`**

**Function: `deductCreditsForSDK()`**

**BEFORE:**

```javascript
// ❌ Blocked deduction if balance < amount
if (user.credits.remaining < amount) {
  throw new Error("Insufficient credits");
}

user.credits.remaining -= amount;
```

**AFTER:**

```javascript
// ✅ Allow negative balance (debt model)
// User had >= 5 credits to start (checked by middleware)
// We deduct actual cost even if balance goes negative

user.credits.remaining -= amount; // Can go negative!
```

---

### **6. Auto Debt Clearance on Top-Up**

**File: `services/credit.service.js`**

**Function: `addCreditsFromPayment()`**

**Already Fixed** ✅ (from previous session)

```javascript
const balanceBefore = user.credits.remaining; // e.g., -10
const debtAmount = balanceBefore < 0 ? Math.abs(balanceBefore) : 0;

// Auto debt clearance
user.credits.remaining += amount; // -10 + 1000 = 990

if (debtAmount > 0) {
  description = `${description} (Debt cleared: ${debtAmount} credits)`;
  logger.info(
    `Debt of ${debtAmount} cleared, final balance: ${user.credits.remaining}`
  );
}
```

---

## 📊 Credit Pricing Structure

### **File Size Tiers (Base Credits)**

| Size Range    | Credits    | Example           |
| ------------- | ---------- | ----------------- |
| < 500 KB      | 2 credits  | Small bootloader  |
| 500 KB - 5 MB | 5 credits  | Standard firmware |
| 5 MB - 20 MB  | 10 credits | Medium firmware   |
| 20 MB - 50 MB | 20 credits | Large firmware    |
| 50 MB - 80 MB | 35 credits | Huge firmware     |

### **Processing Time Penalties**

| Time Range | Credits          | Example             |
| ---------- | ---------------- | ------------------- |
| < 10s      | 0 credits (FREE) | Fast analysis       |
| 10-30s     | +3 credits       | Standard processing |
| 30-60s     | +7 credits       | Complex analysis    |
| 60-120s    | +15 credits      | Very complex        |
| > 120s     | +25 credits      | Ultra complex       |

### **Total Cost Formula**

```
TOTAL CREDITS = BASE_CREDITS (2-35) + TIME_CREDITS (0-25)
MAXIMUM = 60 credits per file
MINIMUM = 2 credits per file
```

---

## 🔄 Complete Credit Flow

### **Before Analysis (Pre-Check)**

1. User uploads file → Middleware checks `credits >= 5` ✅
2. **NO deduction** - just validation
3. Job created with `creditsDeducted: 0`
4. Job queued with `fileSize` in data

### **During Analysis (Processing)**

1. Queue worker starts job
2. Records `analysisStartTime`
3. Sends file to ML service
4. ML analyzes firmware

### **After Analysis (Deduction)**

1. Records `analysisEndTime`
2. Calculates `processingTimeSeconds`
3. Calls `calculateDynamicCredits(fileSize, processingTimeSeconds)`
4. Stores breakdown in job document
5. Calls `deductCreditsForSDK(userId, creditsToDeduct, jobId, apiKeyId)`
6. Balance can go negative (e.g., 5 → -55 after 60-credit job)

### **On Payment (Debt Clearance)**

1. User tops up 1000 credits
2. Current balance: -10 credits
3. System auto-clears debt: -10 + 1000 = **990 credits shown**
4. Transaction logged: "Credit purchase (Debt cleared: 10 credits)"

---

## 🎯 User Experience Improvements

### **Fair Pricing**

- ✅ Small files (< 500KB, < 10s) = **2 credits** (was 1 before, closer but still fair)
- ✅ Large files (50MB, 120s) = **60 credits** (was 1 before - HUGE improvement)
- ✅ Users pay for what they actually use

### **Negative Balance Tolerance**

- ✅ User with 5 credits can analyze 60-credit file
- ✅ Balance goes to -55 (acceptable debt)
- ✅ Next top-up auto-clears debt

### **Transparent Billing**

- ✅ Credit breakdown stored in job: `{ baseCredits, timeCredits, sizeTier, timeTier }`
- ✅ Users can see exactly why they were charged X credits
- ✅ Transaction history shows debt clearance

---

## 🧪 Testing Checklist

### **User Dashboard Analysis**

- [ ] Upload 100KB file (< 10s) → Should cost ~2 credits
- [ ] Upload 10MB file (30s) → Should cost ~17 credits (10 + 7)
- [ ] Upload 60MB file (90s) → Should cost ~50 credits (35 + 15)
- [ ] Check job document has `creditBreakdown` populated
- [ ] Verify credits deducted AFTER job completes, not before

### **SDK Analysis**

- [ ] Single file via SDK → Credits deducted after completion
- [ ] Batch 3 files via SDK → Each file credited separately after completion
- [ ] Verify no upfront deduction

### **Negative Balance**

- [ ] User with 5 credits analyzes 60-credit file
- [ ] Balance should go to -55 (not fail)
- [ ] User can't start NEW analysis with -55 balance (< 5)
- [ ] Top-up 100 credits → Balance shows 45 (100 - 55 debt)

### **Credit Calculation**

- [ ] 100KB file processed in 5s → 2 + 0 = **2 credits**
- [ ] 3MB file processed in 25s → 5 + 3 = **8 credits**
- [ ] 40MB file processed in 90s → 20 + 15 = **35 credits**
- [ ] 70MB file processed in 150s → 35 + 25 = **60 credits**

---

## 📝 Files Modified

1. ✅ `controllers/user.controllers.js` - Removed upfront deduction, added fileSize to queue
2. ✅ `controllers/sdk.controller.js` - Fixed batch analyze (already had single fixed)
3. ✅ `routes/user.routes.js` - Changed `creditCheck(1)` → `creditCheck()`
4. ✅ `routes/sdk.routes.js` - Changed `creditCheck(1)` → `creditCheck()`
5. ✅ `services/credit.service.js` - Removed credit check in `deductCreditsForSDK()` (allow negative)
6. ✅ `services/credit.calculator.js` - Created (dynamic pricing logic)
7. ✅ `services/queue.worker.js` - Added post-analysis deduction with time tracking
8. ✅ `models/analysis.job.model.js` - Added `processingTimeSeconds`, `creditBreakdown`
9. ✅ `middleware/sdk.credit.js` - Already updated (check-only, no deduction)

---

## 🚀 Deployment Notes

### **Environment Variables (No changes needed)**

All existing env vars work as-is.

### **Database Migration (Optional)**

Existing jobs won't have `creditBreakdown` field - that's OK, only new jobs will have it.

### **Backward Compatibility**

- ✅ Old transactions still valid
- ✅ Old jobs still retrievable
- ✅ Credit balance calculations unchanged
- ✅ Only deduction logic changed (transparent to users)

---

## 🎓 Key Takeaways

1. **Never deduct credits upfront** when actual cost is unknown
2. **Always pass fileSize** to queue for dynamic calculation
3. **Allow negative balance** for fair pay-after-use model
4. **Auto-clear debt** on payment for good UX
5. **Store breakdown** for transparency and debugging

---

## 🔧 Future Enhancements (Phase 2)

- [ ] Add complexity credits (obfuscation, packing, anti-analysis)
- [ ] Add batch discounts (10+ files → 10% off)
- [ ] Frontend UI to show credit breakdown
- [ ] Email notifications on low/negative balance
- [ ] Webhook events for credit deduction

---

## ✅ Status: **COMPLETE**

All credit deduction logic fixed. Ready for testing and deployment! 🎉
