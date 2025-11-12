import nodemailer from "nodemailer";

/**
 * Create email transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

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
  const transporter = createTransporter();

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || "Cypher-Ray"}" <${
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
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .credentials-box {
            background: white;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .credential-item {
            margin: 10px 0;
          }
          .credential-label {
            font-weight: bold;
            color: #667eea;
          }
          .credential-value {
            font-family: monospace;
            background: #f0f0f0;
            padding: 8px 12px;
            border-radius: 3px;
            display: inline-block;
            margin-top: 5px;
            font-size: 14px;
            user-select: all;
          }
          .password-highlight {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            border: 2px dashed #667eea;
          }
          .password-text {
            font-family: monospace;
            font-size: 18px;
            font-weight: bold;
            color: #667eea;
            letter-spacing: 1px;
            user-select: all;
            cursor: pointer;
          }
          .copy-instruction {
            font-size: 12px;
            color: #666;
            margin-top: 8px;
            font-style: italic;
          }
          .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome to Cypher-Ray</h1>
          <p>Your Enterprise Solution for Advanced Analytics</p>
        </div>
        
        <div class="content">
          <h2>Hello ${organizationName},</h2>
          
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
            <strong>⚠️ Security Notice:</strong><br>
            This is a temporary password. For your security, please change your password immediately after your first login.
          </div>
          
          <h3>Getting Started:</h3>
          <ol>
            <li>Click the login button above or visit: <a href="${
              process.env.FRONTEND_URL
            }">${process.env.FRONTEND_URL}</a></li>
            <li>Enter your username and temporary password</li>
            <li>Change your password from the profile settings</li>
            <li>Start using the platform</li>
          </ol>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Cypher-Ray. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to: ${email}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending email:", error);
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
  const transporter = createTransporter();

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || "Cypher-Ray"}" <${
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
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        
        <div class="content">
          <p>Hello ${username},</p>
          
          <p>We received a request to reset your password. Click the button below to set a new password:</p>
          
          <div style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
          </div>
          
          <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
          
          <p><strong>Note:</strong> This link will expire in 1 hour.</p>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Cypher-Ray. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to: ${email}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return { success: false, error: error.message };
  }
};
