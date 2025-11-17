# OTP-Based Password Change System

## Overview
Implemented secure OTP-based password change system for Cypher-Ray platform.

## Flow

### Step 1: Request Password Change with OTP
**Endpoint:** `POST /api/user/password/request-otp`
**Headers:** `Authorization: Bearer <user_token>`
**Body:**
```json
{
  "currentPassword": "your_current_password",
  "newPassword": "your_new_password"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "OTP sent to your email",
  "requiresOTP": true,
  "expiresIn": "2 minutes"
}
```

**Response (Error - Wrong Current Password):**
```json
{
  "success": false,
  "message": "Current password is incorrect"
}
```

### Step 2: Verify OTP and Complete Password Change
**Endpoint:** `PUT /api/user/password/verify-otp`
**Headers:** `Authorization: Bearer <user_token>`
**Body:**
```json
{
  "otp": "123456",
  "newPassword": "your_new_password"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Response (Error - Invalid OTP):**
```json
{
  "success": false,
  "message": "Invalid OTP code"
}
```

**Response (Error - Expired OTP):**
```json
{
  "success": false,
  "message": "OTP has expired. Please request a new password change."
}
```

## Features Implemented

### Backend
1. ✅ **OTP Model** (`models/otp.model.js`)
   - Stores: userId, otp, purpose, used, expiresAt, timestamps
   - Auto-expires after 2 minutes
   - Connected to User model via userId

2. ✅ **Email Service** (`utils/send.email.js`)
   - New function: `sendPasswordChangeOTP()`
   - Styled email template matching existing design
   - Includes: OTP code, expiry warning (2 minutes), security notice
   - Uses verified domain: `noreply@cypherray.aadi01.me`

3. ✅ **OTP Service** (`services/otp.service.js`)
   - `createPasswordChangeOTP()`: Generates 6-digit OTP, sends email
   - `verifyPasswordChangeOTP()`: Validates OTP, checks expiry, marks as used
   - Automatic OTP generation (100000-999999)

4. ✅ **User Service Updates** (`services/user.service.js`)
   - `requestPasswordChangeOTP()`: Validates current password, creates OTP
   - `verifyOTPAndChangePassword()`: Verifies OTP, updates password
   - Kept original `changePasswordService()` for backward compatibility

5. ✅ **Controllers** (`controllers/user.controllers.js`)
   - `requestPasswordChangeOTPController()`: Handles OTP request
   - `verifyOTPAndChangePasswordController()`: Handles OTP verification
   - Input validation (password length, OTP format)
   - Security checks (current password correctness)

6. ✅ **Routes** (`routes/user.routes.js`)
   - `POST /api/user/password/request-otp` - Request OTP
   - `PUT /api/user/password/verify-otp` - Verify OTP and change password
   - `PUT /api/user/password/change` - Old method (backward compatibility)

## Security Features

1. **Current Password Verification**: OTP only sent if current password is correct
2. **2-Minute Expiry**: OTP automatically expires after 2 minutes
3. **One-Time Use**: OTP marked as used after successful verification
4. **No Resend**: Users must start over if OTP expires (as per requirement)
5. **6-Digit Code**: Secure random OTP (100000-999999)
6. **Email Verification**: OTP sent to registered email only

## Email Template
- Professional design matching existing Cypher-Ray emails
- Large, easy-to-read OTP code (36px, monospace)
- Yellow warning box with 2-minute expiry notice
- Red security notice: Don't share OTP, contact support if suspicious
- Clean, branded layout with gradient header

## Testing Steps

### Manual Testing
1. Login as a user
2. Make POST request to `/api/user/password/request-otp`:
   - Provide current password + new password
   - Should receive "OTP sent to your email"
3. Check email for 6-digit OTP
4. Make PUT request to `/api/user/password/verify-otp`:
   - Provide OTP + new password
   - Should receive "Password changed successfully"
5. Login with new password to verify

### Test Cases
- ✅ Wrong current password → Error (no OTP sent)
- ✅ Valid current password → OTP sent
- ✅ Valid OTP within 2 minutes → Password changed
- ✅ Invalid OTP → Error message
- ✅ Expired OTP (after 2 minutes) → Error message
- ✅ Reusing same OTP → Error (already used)
- ✅ Weak password validation (< 6 chars) → Error
- ✅ Same current and new password → Error

## Database Collections

### OTP Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  otp: "123456",
  purpose: "password_change",
  used: false,
  expiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## Frontend Integration (Next Steps)

1. Create password change form with:
   - Current password field
   - New password field
   - Submit button

2. On submit:
   - Call `POST /api/user/password/request-otp`
   - If success, show OTP popup modal

3. OTP Modal:
   - 6-digit input box
   - "Verify OTP" button
   - Countdown timer (2 minutes)
   - Submit calls `PUT /api/user/password/verify-otp`

4. Success:
   - Show success message
   - Close modal
   - Maybe force re-login for security

## Environment Variables
No new environment variables needed. Uses existing:
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_FROM_NAME`

## Backward Compatibility
Old password change endpoint still works:
- `PUT /api/user/password/change` (no OTP required)
- Can be removed later if not needed

## Production Checklist
- ✅ Email service configured (Resend with verified domain)
- ✅ OTP expiry set to 2 minutes
- ✅ No OTP resend functionality (as per requirement)
- ✅ Security notices in email
- ✅ Input validation on all endpoints
- ✅ Error handling with clear messages
- ⏳ Frontend implementation pending
