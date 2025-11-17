# Email Service Migration Guide

## Overview

Migrated from Gmail SMTP (nodemailer) to Resend API to fix production email failures on Render.com.

## Why Migration Was Needed

### Problem

- **Local Development**: Emails worked fine with Gmail SMTP
- **Production (Render.com)**: All emails failed with timeout errors
- **Root Cause**: Render blocks outbound connections on SMTP ports (25, 465, 587)
- **Error Message**: `Connection timeout, code: 'ETIMEDOUT', command: 'CONN'`

### Solution

- **Resend API**: Uses HTTPS (port 443) instead of SMTP
- **Result**: Works in all environments including Render, Heroku, Vercel
- **Benefits**:
  - No port blocking issues
  - Better deliverability
  - 3,000 free emails/month
  - Simple API

## Changes Made

### Files Updated

1. **`utils/send.email.js`**

   - Removed: nodemailer transporter
   - Added: Resend client
   - Functions: `sendWelcomeEmail()`, `sendPasswordResetEmail()`

2. **`services/payment.email.service.js`**
   - Removed: nodemailer transporter
   - Added: Resend client
   - Function: `sendPaymentSuccessEmail()`

### Code Changes

**Before (nodemailer):**

```javascript
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

await transporter.sendMail({
  from: '"Cypher-Ray" <noreply@cypherray.com>',
  to: email,
  subject: "Welcome",
  html: htmlContent,
});
```

**After (Resend):**

```javascript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: "Cypher-Ray <onboarding@yourdomain.com>",
  to: email,
  subject: "Welcome",
  html: htmlContent,
});
```

### Environment Variables

**Removed:**

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password
```

**Added:**

```env
RESEND_API_KEY=re_4x1xY1Mj_N1AxNGysPZhZcK384NkPd1JY
EMAIL_FROM=onboarding@yourdomain.com
EMAIL_FROM_NAME=Cypher-Ray
```

## Deployment Checklist

### Step 1: Get Resend API Key

1. Go to [resend.com](https://resend.com)
2. Sign up for free account
3. Verify domain (or use dev domain for testing)
4. Generate API key from dashboard

### Step 2: Update Local Environment

```bash
cd cypher-ray-backend
```

Edit `.env`:

```env
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=onboarding@yourdomain.com
EMAIL_FROM_NAME=Cypher-Ray
```

### Step 3: Test Locally

```bash
npm run dev
```

Test email sending:

- Create a new user via admin panel
- Should receive welcome email
- Make a payment
- Should receive payment success email

### Step 4: Deploy to Render

1. Go to Render dashboard
2. Select your backend service
3. Go to "Environment" tab
4. Add new variables:
   - `RESEND_API_KEY` = `re_your_api_key_here`
   - `EMAIL_FROM` = `onboarding@yourdomain.com`
   - `EMAIL_FROM_NAME` = `Cypher-Ray`
5. Remove old variables:
   - `EMAIL_HOST`
   - `EMAIL_PORT`
   - `EMAIL_USER`
   - `EMAIL_PASS`
6. Click "Save Changes"
7. Service will auto-redeploy

### Step 5: Verify Production

1. Go to production frontend
2. Login as admin
3. Create test user
4. Check email inbox
5. Make test payment
6. Verify payment email received

## Resend Configuration

### Domain Setup

**Option 1: Use Resend Domain (Testing)**

- No setup needed
- Use: `onboarding@resend.dev`
- Limited deliverability

**Option 2: Verify Your Domain (Production)**

1. Go to Resend → Domains → Add Domain
2. Add your domain (e.g., `cypherray.com`)
3. Add DNS records provided by Resend
4. Wait for verification
5. Use: `noreply@cypherray.com` or `support@cypherray.com`

### API Keys

- Generate separate keys for dev/production
- Keep keys secret
- Rotate keys regularly
- Don't commit keys to Git

## Testing

### Test Welcome Email

```bash
# Via admin panel
curl -X POST http://localhost:5000/api/admin/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "organizationName": "Test Org"
  }'
```

### Test Payment Email

```bash
# Make a test payment via frontend
# Or trigger directly (in development)
```

## Troubleshooting

### Email Not Received

**Check 1: Spam Folder**

- Resend emails might land in spam initially
- Mark as "Not Spam" to improve deliverability

**Check 2: API Key**

```bash
# Verify API key is set
echo $RESEND_API_KEY
```

**Check 3: Domain Verification**

- Unverified domains have limited deliverability
- Verify domain for production use

**Check 4: Logs**

```bash
# Check Render logs
# Look for email sending errors
```

### API Errors

**Error: "Invalid API key"**

- Check `.env` has correct key
- Verify key is active in Resend dashboard

**Error: "Unverified domain"**

- Use verified domain or `resend.dev` domain
- Complete domain verification in Resend

**Error: "Rate limit exceeded"**

- Free plan: 100 emails/day, 3,000/month
- Upgrade plan if needed

## Rollback Plan

If Resend doesn't work, rollback to Gmail:

1. Install nodemailer:

```bash
npm install nodemailer
```

2. Restore old code in email files
3. Add Gmail credentials to `.env`
4. **Note**: Will still fail on Render (SMTP blocked)

## Benefits of Resend

✅ Works on all hosting platforms (no SMTP blocks)
✅ Better deliverability than Gmail
✅ Simple API (no SMTP config)
✅ Free tier: 3,000 emails/month
✅ Better analytics and tracking
✅ No "less secure app" warnings
✅ Dedicated IP option (paid plans)
✅ Webhook support for bounce/spam reports

## Comparison

| Feature          | Gmail SMTP | Resend API  |
| ---------------- | ---------- | ----------- |
| Works on Render  | ❌ No      | ✅ Yes      |
| Setup Complexity | Medium     | Easy        |
| Free Tier        | 500/day    | 3,000/month |
| Deliverability   | Good       | Better      |
| Port Blocking    | Yes        | No          |
| 2FA Issues       | Yes        | No          |
| API-based        | No         | Yes         |

## Support

- Resend Docs: https://resend.com/docs
- Resend Status: https://status.resend.com
- Render Support: https://render.com/docs

## Notes

- Migration completed: January 2025
- Package installed: `resend@latest`
- Zero downtime migration (backward compatible)
- Same email templates maintained
- No controller changes needed
- Environment variable names changed
