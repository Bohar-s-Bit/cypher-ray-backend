import { Resend } from "resend";

/**
 * Create Resend client
 */
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send welcome email with credentials
 * @param {Object} data - Email data
 * @param {String} data.email - Recipient email
 * @param {String} data.username - Username
 * @param {String} data.password - Temporary password
 * @param {String} data.organizationName - Organization name
 * @param {String} data.tier - Tier information
 * @param {Number} data.credits - Credit balance
 */
export const sendWelcomeEmail = async ({
  email,
  username,
  password,
  organizationName,
  tier,
  credits,
}) => {
  try {
    const result = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME || "Cypher-Ray"} <${
        process.env.EMAIL_FROM
      }>`,
      to: email,
      subject: "Welcome to Cypher-Ray - Your Account is Ready",
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            max-width: 600px;
            margin: 0 auto;
            padding: 0;
            background-color: #f9fafb;
          }
          .email-wrapper {
            background-color: #ffffff;
            margin: 20px;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(45, 27, 71, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #2d1b47 0%, #4a0582 50%, #7808d0 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: 600;
          }
          .header p {
            margin: 0;
            font-size: 16px;
            opacity: 0.9;
          }
          .content {
            background: #ffffff;
            padding: 40px 30px;
          }
          .content h2 {
            color: #2d1b47;
            font-size: 20px;
            margin: 0 0 20px 0;
          }
          .content p {
            color: #4b5563;
            margin: 0 0 15px 0;
          }
          .credentials-box {
            background: #f9fafb;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            padding: 24px;
            margin: 24px 0;
          }
          .credential-item {
            margin: 16px 0;
          }
          .credential-label {
            font-weight: 600;
            color: #7c3aed;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
          }
          .credential-value {
            font-family: 'Courier New', monospace;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            padding: 10px 14px;
            border-radius: 6px;
            display: inline-block;
            margin-top: 5px;
            font-size: 15px;
            color: #1f2937;
            user-select: all;
          }
          .password-highlight {
            background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
            border: 2px solid #c084fc;
          }
          .password-text {
            font-family: 'Courier New', monospace;
            font-size: 20px;
            font-weight: 700;
            color: #7808d0;
            letter-spacing: 2px;
            user-select: all;
            cursor: pointer;
            word-break: break-all;
          }
          .copy-instruction {
            font-size: 12px;
            color: #6b7280;
            margin-top: 10px;
            font-style: normal;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #7c3aed 0%, #7808d0 100%);
            color: #ffffff !important;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 8px;
            margin: 24px 0;
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
          }
          .logo {
            max-width: 180px;
            height: auto;
            margin-bottom: 20px;
          }
          .warning {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            margin: 24px 0;
            border-radius: 6px;
          }
          .warning strong {
            color: #92400e;
          }
          .section-title {
            color: #2d1b47;
            font-size: 16px;
            font-weight: 600;
            margin: 24px 0 12px 0;
          }
          .footer {
            background: #f9fafb;
            text-align: center;
            padding: 30px;
            color: #6b7280;
            font-size: 13px;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 8px 0;
          }
          ol {
            color: #4b5563;
            padding-left: 20px;
          }
          ol li {
            margin: 8px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <img src="${process.env.BACKEND_URL || 'http://localhost:6005'}/assets/logo.png" alt="Cypher-Ray" class="logo" />
            <h1>Welcome to Cypher-Ray</h1>
            <p>Your Enterprise Solution for Advanced Analytics</p>
          </div>
          
          <div class="content">
            <h2>Hello, ${organizationName}</h2>
            
            <p>Your account has been successfully created on the Cypher-Ray platform. Below are your login credentials and account details:</p>
          
          <div class="credentials-box">
            <div class="credential-item">
              <div class="credential-label">Organization:</div>
              <div class="credential-value">${organizationName}</div>
            </div>
            
            <div class="credential-item">
              <div class="credential-label">Username:</div>
              <div class="credential-value">${username}</div>
            </div>
            
            <div class="credential-item">
              <div class="credential-label">Temporary Password:</div>
              <div class="password-highlight">
                <div class="password-text" title="Click to select, then copy">${password}</div>
                <div class="copy-instruction">
                  💡 Click on the password above to select it, then press Ctrl+C (Windows) or Cmd+C (Mac) to copy
                </div>
              </div>
            </div>
            
            <div class="credential-item">
              <div class="credential-label">Tier:</div>
              <div class="credential-value">${tier || "Standard"}</div>
            </div>
            
            <div class="credential-item">
              <div class="credential-label">Available Credits:</div>
              <div class="credential-value">${
                credits === 999999 ? "Unlimited" : credits.toLocaleString()
              }</div>
            </div>
          </div>
          
            <div style="text-align: center;">
              <a href="${
                process.env.FRONTEND_URL
              }/login" class="button">Login to Dashboard</a>
            </div>
            
            <div class="warning">
              <strong>Security Notice</strong><br>
              This is a temporary password. For your security, please change your password immediately after your first login.
            </div>
            
            <h3 class="section-title">Getting Started:</h3>
            <ol>
              <li>Click the login button above or visit: <a href="${
                process.env.FRONTEND_URL
              }" style="color: #7c3aed;">${process.env.FRONTEND_URL}</a></li>
              <li>Enter your username and temporary password</li>
              <li>Change your password from the profile settings</li>
              <li>Start using the platform</li>
            </ol>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          </div>
          
          <div class="footer">
            <p><strong>© ${new Date().getFullYear()} Cypher-Ray. All rights reserved.</strong></p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    });

    console.log("Resend API Response:", JSON.stringify(result, null, 2));

    if (result.data?.id) {
      console.log(`✅ Welcome email sent to: ${email} (ID: ${result.data.id})`);
      return { success: true, emailId: result.data.id };
    } else if (result.error) {
      console.error("❌ Resend API Error:", result.error);
      return {
        success: false,
        error: result.error.message || "Email service error",
      };
    } else {
      console.error("❌ Email send failed - unexpected response format");
      console.error("Response:", result);
      return { success: false, error: "No confirmation from email service" };
    }
  } catch (error) {
    console.error("❌ Error sending welcome email:", error.message);
    console.error("Full error:", error);
    console.error("Email details:", {
      to: email,
      from: process.env.EMAIL_FROM,
    });
    // Don't throw error - email failure shouldn't block user creation
    return { success: false, error: error.message };
  }
};

/**
 * Send password reset email
 * @param {Object} data - Email data
 * @param {String} data.email - Recipient email
 * @param {String} data.username - Username
 * @param {String} data.resetLink - Password reset link
 */
export const sendPasswordResetEmail = async ({
  email,
  username,
  resetLink,
}) => {
  try {
    const result = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME || "Cypher-Ray"} <${
        process.env.EMAIL_FROM
      }>`,
      to: email,
      subject: "Password Reset Request - Cypher-Ray",
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            max-width: 600px;
            margin: 0 auto;
            padding: 0;
            background-color: #f9fafb;
          }
          .email-wrapper {
            background-color: #ffffff;
            margin: 20px;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(45, 27, 71, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #2d1b47 0%, #4a0582 50%, #7808d0 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            background: #ffffff;
            padding: 40px 30px;
          }
          .content p {
            color: #4b5563;
            margin: 0 0 15px 0;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #7c3aed 0%, #7808d0 100%);
            color: #ffffff !important;
            padding: 14px 32px;
            text-decoration: none;
            border-radius: 8px;
            margin: 24px 0;
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
          }
          .logo {
            max-width: 180px;
            height: auto;
            margin-bottom: 20px;
          }
          .info-box {
            background: #f3f4f6;
            border-left: 4px solid #7c3aed;
            padding: 16px;
            margin: 24px 0;
            border-radius: 6px;
          }
          .footer {
            background: #f9fafb;
            text-align: center;
            padding: 30px;
            color: #6b7280;
            font-size: 13px;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 8px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <img src="${process.env.BACKEND_URL || 'http://localhost:6005'}/assets/logo.png" alt="Cypher-Ray" class="logo" />
            <h1>Password Reset Request</h1>
          </div>
          
          <div class="content">
            <p>Hello ${username},</p>
            
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            
            <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
            
            <div class="info-box">
              <strong>Note:</strong> This link will expire in 1 hour.
            </div>
          </div>
          
          <div class="footer">
            <p><strong>© ${new Date().getFullYear()} Cypher-Ray. All rights reserved.</strong></p>
          </div>
        </div>
      </body>
      </html>
    `,
    });

    if (result.data?.id) {
      console.log(
        `✅ Password reset email sent to: ${email} (ID: ${result.data.id})`
      );
      return { success: true, emailId: result.data.id };
    } else {
      console.error("❌ Email send failed - no confirmation ID received");
      return { success: false, error: "No confirmation from email service" };
    }
  } catch (error) {
    console.error("❌ Error sending password reset email:", error.message);
    console.error("Email details:", {
      to: email,
      from: process.env.EMAIL_FROM,
    });
    return { success: false, error: error.message };
  }
};

/**
 * Send OTP for password change
 * @param {Object} data - Email data
 * @param {String} data.email - Recipient email
 * @param {String} data.username - Username
 * @param {String} data.otp - 6-digit OTP
 */
export const sendPasswordChangeOTP = async ({ email, username, otp }) => {
  try {
    const result = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME || "Cypher-Ray"} <${
        process.env.EMAIL_FROM
      }>`,
      to: email,
      subject: "Password Change OTP - Cypher-Ray",
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            max-width: 600px;
            margin: 0 auto;
            padding: 0;
            background-color: #f9fafb;
          }
          .email-wrapper {
            background-color: #ffffff;
            margin: 20px;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(45, 27, 71, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #2d1b47 0%, #4a0582 50%, #7808d0 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: 600;
          }
          .header p {
            margin: 0;
            font-size: 16px;
            opacity: 0.9;
          }
          .content {
            background: #ffffff;
            padding: 40px 30px;
          }
          .content p {
            color: #4b5563;
            margin: 0 0 15px 0;
          }
          .otp-box {
            background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
            border: 3px solid #c084fc;
            padding: 30px;
            margin: 30px 0;
            border-radius: 12px;
            text-align: center;
          }
          .otp-code {
            font-family: 'Courier New', monospace;
            font-size: 42px;
            font-weight: 700;
            color: #7808d0;
            letter-spacing: 10px;
            user-select: all;
            margin: 15px 0;
          }
          .otp-label {
            font-size: 13px;
            color: #6b7280;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .warning {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            margin: 24px 0;
            border-radius: 6px;
          }
          .warning strong {
            color: #92400e;
          }
          .security-notice {
            background: #fee2e2;
            border-left: 4px solid #ef4444;
            padding: 16px;
            margin: 24px 0;
            border-radius: 6px;
            color: #991b1b;
          }
          .security-notice strong {
            color: #7f1d1d;
          }
          .security-notice ul {
            margin: 8px 0 0 0;
            padding-left: 20px;
          }
          .security-notice li {
            margin: 4px 0;
          }
          .footer {
            background: #f9fafb;
            text-align: center;
            padding: 30px;
            color: #6b7280;
            font-size: 13px;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 8px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <img src="${process.env.BACKEND_URL || 'http://localhost:6005'}/assets/logo.png" alt="Cypher-Ray" class="logo" />
            <h1>Password Change Request</h1>
            <p>One-Time Password Verification</p>
          </div>
          
          <div class="content">
            <p>Hello ${username},</p>
            
            <p>You have requested to change your password. Please use the OTP below to complete the process:</p>
            
            <div class="otp-box">
              <div class="otp-label">Your One-Time Password</div>
              <div class="otp-code">${otp}</div>
              <div class="otp-label">Enter this code in the password change form</div>
            </div>
            
            <div class="warning">
              <strong>⏱ Time Sensitive</strong><br>
              This OTP will expire in <strong>2 minutes</strong>. Please enter it immediately.
            </div>
            
            <div class="security-notice">
              <strong>Security Notice</strong>
              <ul>
                <li>Do NOT share this OTP with anyone</li>
                <li>Cypher-Ray staff will never ask for your OTP</li>
                <li>If you didn't request this change, please contact support immediately</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>© ${new Date().getFullYear()} Cypher-Ray. All rights reserved.</strong></p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    });

    if (result.data?.id) {
      console.log(
        `✅ Password change OTP sent to: ${email} (ID: ${result.data.id})`
      );
      return { success: true, emailId: result.data.id };
    } else if (result.error) {
      console.error("❌ Resend API Error:", result.error);
      return {
        success: false,
        error: result.error.message || "Email service error",
      };
    } else {
      console.error("❌ Email send failed - unexpected response format");
      return { success: false, error: "No confirmation from email service" };
    }
  } catch (error) {
    console.error("❌ Error sending OTP email:", error.message);
    console.error("Email details:", { to: email, from: process.env.EMAIL_FROM });
    return { success: false, error: error.message };
  }
};
