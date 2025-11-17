#!/bin/bash

# Test Payment Verification Flow
# This simulates a successful payment to trigger email notification

BASE_URL="https://00466d4983d9.ngrok-free.app"
EMAIL="aadipatel1911@gmail.com"

echo "============================================"
echo "Testing Payment Email Notification"
echo "============================================"
echo ""

# Step 1: Login
echo "Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  --data-raw '{"email":"'$EMAIL'","password":"^YyNtM6cGf"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')
echo "✅ Login successful"
echo "Token: ${TOKEN:0:50}..."
echo ""

# Step 2: Create Order
echo "Step 2: Creating payment order..."
ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/payment/create-order" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{"planId":"basic"}')

ORDER_ID=$(echo "$ORDER_RESPONSE" | jq -r '.order.id')
PAYMENT_ID=$(echo "$ORDER_RESPONSE" | jq -r '.order.paymentId')

echo "✅ Order created"
echo "Order ID: $ORDER_ID"
echo "Payment ID: $PAYMENT_ID"
echo ""

# Step 3: Information
echo "============================================"
echo "TO COMPLETE PAYMENT & GET EMAIL:"
echo "============================================"
echo ""
echo "You have 3 options:"
echo ""
echo "📱 OPTION 1: Use Razorpay Frontend SDK (Recommended)"
echo "   1. Create a simple HTML file with Razorpay checkout"
echo "   2. Use test card: 4111 1111 1111 1111"
echo "   3. Complete payment"
echo "   4. Call /api/payment/verify with response"
echo "   5. Email will be sent automatically"
echo ""
echo "🔧 OPTION 2: Use Razorpay Test Mode API"
echo "   1. Go to: https://dashboard.razorpay.com/app/dashboard"
echo "   2. Find order: $ORDER_ID"
echo "   3. Mark as paid (test mode)"
echo "   4. Webhook will trigger and email will be sent"
echo ""
echo "⚡ OPTION 3: Manual Simulation (I can create this for you)"
echo "   - Create a mock payment verification"
echo "   - Note: Signature verification will fail but email will be sent"
echo ""
echo "============================================"
echo ""
echo "Want me to create Option 3 test script? (y/n)"
