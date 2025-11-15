# 💳 Cypher-Ray Credits & Payment System

Complete documentation for the Razorpay-integrated credit purchase system.

---

## 📊 Credit Plans & Pricing

| Plan           | Credits | Price (INR) | Per Credit Cost | Popular |
| -------------- | ------- | ----------- | --------------- | ------- |
| **Basic**      | 100     | ₹1,000      | ₹10.00          | -       |
| **Standard**   | 500     | ₹4,500      | ₹9.00           | ⭐      |
| **Premium**    | 1,000   | ₹8,000      | ₹8.00           | -       |
| **Enterprise** | 3,000   | ₹20,000     | ₹6.67           | -       |
| **Ultimate**   | 5,000   | ₹30,000     | ₹6.00           | -       |

### 💡 Best Value

The **Standard** plan offers the best balance between price and credits, making it perfect for regular users.

---

## 🔧 Setup & Configuration

### 1. Environment Variables

Add these to your `.env` file:

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_Rg5dccWy38YbdL
RAZORPAY_KEY_SECRET=zCH92B6YApJpmhBM7GaF3fiP
RAZORPAY_WEBHOOK_SECRET=wc_r_xsU8Rjh_nY

# Frontend URL (for email templates)
FRONTEND_URL=http://localhost:5173

# Email Configuration (for payment notifications)
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=Cypher-Ray
EMAIL_PASSWORD=your-app-password
```

### 2. Webhook Configuration

**Ngrok Setup (for local testing):**

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Forward port 6005
ngrok http 6005
```

**Configure Webhook in Razorpay Dashboard:**

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com) → Settings → Webhooks
2. Add webhook URL: `https://your-ngrok-url.ngrok-free.app/api/payment/webhook`
3. Select events:
   - `payment.captured`
   - `payment.failed`
4. Set webhook secret in `.env` as `RAZORPAY_WEBHOOK_SECRET`

### 3. Start Backend Server

```bash
cd cypher-ray-backend
npm install
npm run dev
```

Server will start on `http://localhost:6005`

---

## 🧪 Testing with Test Cards

Razorpay provides test cards for development. **No real money is charged!**

### ✅ Successful Payment

```
Card Number: 4111 1111 1111 1111
CVV: Any 3 digits (e.g., 123)
Expiry: Any future date (e.g., 12/25)
Name: Any name
```

### ❌ Failed Payment

```
Card Number: 4000 0000 0000 0002
CVV: Any 3 digits
Expiry: Any future date
Name: Any name
```

### 💰 UPI Testing

```
UPI ID: success@razorpay
```

### 🏦 Net Banking

Select any bank → Use credentials:

- Username: `razorpay`
- Password: `razorpay`

---

## 🌐 API Endpoints

### 📋 Public Endpoints

#### Get All Credit Plans

```http
GET /api/payment/plans
```

**Response:**

```json
{
  "success": true,
  "plans": [
    {
      "id": "basic",
      "name": "Basic",
      "credits": 100,
      "price": 1000,
      "amount": 100000,
      "popular": false
    },
    ...
  ]
}
```

---

### 🔒 Authenticated Endpoints

All endpoints below require JWT token in header:

```
Authorization: Bearer <your-jwt-token>
```

#### Create Payment Order

```http
POST /api/payment/create-order
Content-Type: application/json

{
  "planId": "standard"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Payment order created successfully",
  "order": {
    "id": "order_xxxxx",
    "amount": 450000,
    "currency": "INR",
    "paymentId": "675abc123def456789"
  },
  "plan": {
    "name": "Standard",
    "credits": 500,
    "price": 4500
  },
  "key": "rzp_test_Rg5dccWy38YbdL"
}
```

**Rate Limit:** 15 requests per hour

---

#### Verify Payment

```http
POST /api/payment/verify
Content-Type: application/json

{
  "razorpay_order_id": "order_xxxxx",
  "razorpay_payment_id": "pay_xxxxx",
  "razorpay_signature": "signature_xxxxx"
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Payment verified and credits added successfully",
  "credits": 500,
  "payment": {
    "id": "675abc123def456789",
    "orderId": "order_xxxxx",
    "paymentId": "pay_xxxxx",
    "amount": 4500,
    "status": "success"
  }
}
```

**Rate Limit:** 10 requests per 15 minutes

---

#### Get Payment History

```http
GET /api/payment/history?page=1&limit=10
```

**Response:**

```json
{
  "success": true,
  "payments": [
    {
      "id": "675abc123def456789",
      "planName": "Standard",
      "credits": 500,
      "amount": 4500,
      "status": "success",
      "paymentMethod": "card",
      "orderId": "order_xxxxx",
      "paymentId": "pay_xxxxx",
      "date": "2025-01-20T10:30:00.000Z",
      "creditsAdded": true
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalPayments": 42,
    "hasMore": true
  }
}
```

---

#### Retry Failed Payment

```http
POST /api/payment/retry
Content-Type: application/json

{
  "paymentId": "675abc123def456789"
}
```

**Response:**

```json
{
  "success": true,
  "message": "New payment order created for retry",
  "order": {
    "id": "order_new_xxxxx",
    "amount": 450000,
    "currency": "INR",
    "paymentId": "675def789abc123456"
  },
  "plan": { ... },
  "key": "rzp_test_Rg5dccWy38YbdL"
}
```

**Rate Limit:** 15 requests per hour (shared with create-order)

---

### 🔐 Webhook Endpoint

#### Razorpay Webhook Handler

```http
POST /api/payment/webhook
X-Razorpay-Signature: <webhook-signature>
Content-Type: application/json

{
  "event": "payment.captured",
  "payload": { ... }
}
```

**Security:** Automatically verifies webhook signature using HMAC SHA256

**Supported Events:**

- `payment.captured` → Credits added automatically
- `payment.failed` → Email notification sent

---

### 👮 Admin Endpoints

Require admin token in header:

```
Authorization: Bearer <admin-jwt-token>
```

#### Refund Payment

```http
POST /api/payment/refund
Content-Type: application/json

{
  "paymentId": "675abc123def456789",
  "reason": "Customer request"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Payment refunded successfully",
  "refund": {
    "id": "rfnd_xxxxx",
    "amount": 4500,
    "status": "refunded"
  }
}
```

**Note:** Credits are automatically deducted if user has sufficient balance.

---

## 🔄 Payment Flow

### Frontend Payment Flow

```javascript
// 1. User selects a plan
const selectedPlan = "standard";

// 2. Create order
const orderResponse = await fetch("/api/payment/create-order", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ planId: selectedPlan }),
});

const orderData = await orderResponse.json();

// 3. Initialize Razorpay
const options = {
  key: orderData.key,
  amount: orderData.order.amount,
  currency: orderData.order.currency,
  order_id: orderData.order.id,
  name: "Cypher-Ray",
  description: `${orderData.plan.name} - ${orderData.plan.credits} Credits`,
  handler: async function (response) {
    // 4. Verify payment
    const verifyResponse = await fetch("/api/payment/verify", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      }),
    });

    const verifyData = await verifyResponse.json();

    if (verifyData.success) {
      alert(`Success! ${verifyData.credits} credits added to your account`);
    }
  },
  modal: {
    ondismiss: function () {
      console.log("Payment cancelled by user");
    },
  },
};

const razorpay = new Razorpay(options);
razorpay.open();
```

---

## 📧 Email Notifications

### Success Email

- **Trigger:** After successful payment verification
- **Content:** Credits added, plan details, payment ID, amount
- **Action Button:** Go to Dashboard

### Failure Email

- **Trigger:** When payment fails (webhook or verification)
- **Content:** Failure reason, troubleshooting tips
- **Action Button:** Try Again

**Templates:** Located in `/services/payment.email.service.js`

---

## 🔒 Security Features

### 1. **HMAC SHA256 Signature Verification**

- All payment verifications use signature validation
- Prevents fraudulent payment confirmations
- Implemented in `razorpay.service.js`

### 2. **Webhook Signature Verification**

- Verifies webhooks are from Razorpay
- Uses webhook secret for HMAC validation
- Middleware: `verifyWebhook`

### 3. **Payment Ownership Verification**

- Ensures users can only verify their own payments
- Middleware: `verifyPaymentOwnership`

### 4. **Rate Limiting**

- Order creation: 15 per hour
- Payment verification: 10 per 15 minutes
- Prevents abuse and brute force attacks

### 5. **Atomic Transactions**

- Uses MongoDB sessions
- Ensures credits, transactions, and payments update together
- Rollback on failure

---

## 🧑‍💻 Database Models

### Payment Model

```javascript
{
  userId: ObjectId,              // User reference
  razorpayOrderId: String,       // Unique Razorpay order ID
  razorpayPaymentId: String,     // Payment ID after completion
  razorpaySignature: String,     // HMAC signature
  planId: String,                // e.g., "standard"
  planName: String,              // e.g., "Standard"
  creditsAmount: Number,         // Credits purchased
  amount: Number,                // Amount in paise (₹4500 = 450000)
  currency: String,              // "INR"
  status: String,                // created/pending/success/failed/refunded
  paymentMethod: String,         // card/upi/netbanking/wallet
  cardDetails: {
    last4: String,
    network: String,
    type: String
  },
  creditsAdded: Boolean,         // Credits successfully added?
  creditsAddedAt: Date,
  refund: {
    razorpayRefundId: String,
    amount: Number,
    status: String,
    reason: String,
    initiatedAt: Date,
    processedAt: Date
  },
  failureReason: String,
  metadata: {
    ipAddress: String,
    userAgent: String,
    retryOf: ObjectId,           // If retry, references original payment
    attemptCount: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### User Model (Payment Fields)

```javascript
{
  // Existing fields...
  paymentHistory: [ObjectId],    // References to Payment documents
  totalSpent: Number,            // Lifetime money spent (in rupees)
  lifetimeCredits: Number        // Total credits ever purchased
}
```

### CreditTransaction Model (Payment Reference)

```javascript
{
  // Existing fields...
  paymentId: ObjectId; // Reference to Payment document
}
```

---

## 🐛 Troubleshooting

### Issue: Payment successful but credits not added

**Causes:**

- Webhook not configured
- Webhook signature verification failed
- MongoDB transaction failed

**Solution:**

1. Check webhook configuration in Razorpay dashboard
2. Verify `RAZORPAY_WEBHOOK_SECRET` in `.env`
3. Check backend logs for transaction errors
4. Webhook will automatically retry (Razorpay retries 5 times over 24 hours)

---

### Issue: "Invalid webhook signature" error

**Causes:**

- Incorrect webhook secret
- Request body modified

**Solution:**

1. Verify `RAZORPAY_WEBHOOK_SECRET` matches Razorpay dashboard
2. Ensure no middleware modifies request body before webhook handler
3. Check raw body is being used for signature verification

---

### Issue: Rate limit exceeded

**Error:** `Too many payment attempts. Please try again after an hour.`

**Solution:**

- Wait for rate limit window to reset
- For testing, temporarily increase limits in `payment.routes.js`

---

### Issue: Email notifications not sent

**Causes:**

- Invalid email credentials
- Gmail blocking less secure apps

**Solution:**

1. Use App Passwords for Gmail (not regular password)
2. Enable 2FA on Gmail
3. Generate App Password: Google Account → Security → 2FA → App Passwords
4. Update `EMAIL_PASSWORD` in `.env`

---

## 📊 Logging

All payment operations are logged with prefixes:

- `[PAYMENT]` - Payment controller operations
- `[RAZORPAY]` - Razorpay API calls
- `[WEBHOOK]` - Webhook processing
- `[EMAIL]` - Email notifications

**Example:**

```
[PAYMENT] Creating order - User: 675abc123, Plan: Standard
[RAZORPAY] ✅ Order created successfully - OrderID: order_xxxxx
[PAYMENT] ✅ Order created - OrderID: order_xxxxx, PaymentID: 675def456
```

---

## 🚀 Production Checklist

Before deploying to production:

- [ ] Replace test keys with live keys in `.env`
- [ ] Update webhook URL to production domain
- [ ] Configure proper email credentials
- [ ] Set `FRONTEND_URL` to production URL
- [ ] Test all payment flows with test cards
- [ ] Verify email notifications are sent
- [ ] Test webhook signature verification
- [ ] Monitor logs for errors
- [ ] Set up alerts for failed payments
- [ ] Document refund process for support team

---

## 📚 Additional Resources

- [Razorpay Documentation](https://razorpay.com/docs/)
- [Razorpay Test Cards](https://razorpay.com/docs/payments/payments/test-card-details/)
- [Webhook Signatures](https://razorpay.com/docs/webhooks/validate-test/)
- [Payment Flow](https://razorpay.com/docs/payment-gateway/web-integration/)

---

## 🤝 Support

For issues or questions:

- Check logs: `cypher-ray-backend/logs/`
- Email: support@cypherray.com
- GitHub Issues: Create an issue in the repository

---

**Last Updated:** January 2025  
**Version:** 1.0.0
