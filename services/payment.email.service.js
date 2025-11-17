import { Resend } from "resend";

/**
 * Cypher-Ray Logo URL (Google Drive direct link)
 */
const LOGO_URL = "https://drive.google.com/uc?export=view&id=1hX_GDOQk1FcrK0jd3df116TUV-aQkW5_";

/**
 * Create Resend client
 */
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send Payment Success Email
 * @param {String} email - User email
 * @param {Object} paymentDetails - Payment details
 */
export const sendPaymentSuccessEmail = async (email, paymentDetails) => {
  const {
    username,
    planName,
    creditsAmount,
    amount,
    paymentId,
    transactionDate,
  } = paymentDetails;

  try {
    const result = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: "Payment Successful - Credits Added | Cypher-Ray",
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            margin: 0;
            padding: 0;
            background-color: #f9fafb;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
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
            margin: 10px 0;
            font-size: 28px;
            font-weight: 600;
          }
          .header p {
            margin: 0;
            font-size: 16px;
            opacity: 0.95;
          }
          .content {
            background: white;
            padding: 40px 30px;
          }
          .content p {
            color: #4b5563;
            margin: 0 0 15px 0;
            font-size: 15px;
          }
          .credits-highlight {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 28px;
            font-weight: 700;
            border-radius: 10px;
            margin: 30px 0;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          }
          .details {
            background: #f9fafb;
            padding: 24px;
            border-radius: 10px;
            margin: 24px 0;
            border: 2px solid #e5e7eb;
          }
          .details-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .details-row:last-child {
            border-bottom: none;
          }
          .label {
            font-weight: 600;
            color: #6b7280;
            font-size: 14px;
          }
          .value {
            color: #1f2937;
            text-align: right;
            font-weight: 500;
            font-size: 14px;
          }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #7c3aed 0%, #7808d0 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            margin-top: 24px;
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
          }
          .logo {
            max-width: 180px;
            height: auto;
            margin: 0 auto 20px auto;
            display: block;
          }
          .success-badge {
            background: #10b981;
            color: white;
            padding: 10px 24px;
            border-radius: 50px;
            font-weight: 600;
            font-size: 14px;
            display: inline-block;
            margin-bottom: 15px;
          }
          .failed-badge {
            background: #dc2626;
            color: white;
            padding: 10px 24px;
            border-radius: 50px;
            font-weight: 600;
            font-size: 14px;
            display: inline-block;
            margin-bottom: 15px;
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
        <div class="container">
          <div class="header">
            <img src="${LOGO_URL}" alt="Cypher-Ray" class="logo" />
            <div class="success-badge">Payment Successful</div>
            <h1>Credits Added to Your Account</h1>
          </div>
          
          <div class="content">
            <p>Hi ${username},</p>
            
            <p>Great news! Your payment has been successfully processed and <strong>${creditsAmount} credits</strong> have been added to your account.</p>
            
            <div class="credits-highlight">
              + ${creditsAmount} Credits Added
            </div>
            
            <div class="details">
              <div class="details-row">
                <span class="label">Plan </span>
                <span class="value">${planName}</span>
              </div>
              <div class="details-row">
                <span class="label">Credits </span>
                <span class="value">${creditsAmount}</span>
              </div>
              <div class="details-row">
                <span class="label">Amount Paid </span>
                <span class="value">₹${(amount / 100).toLocaleString(
                  "en-IN"
                )}</span>
              </div>
              <div class="details-row">
                <span class="label">Payment ID </span>
                <span class="value">${paymentId}</span>
              </div>
              <div class="details-row">
                <span class="label">Date & Time </span>
                <span class="value">${new Date(transactionDate).toLocaleString(
                  "en-IN",
                  {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }
                )}</span>
              </div>
            </div>
            
            <p>You can now use these credits to analyze firmware binaries and detect cryptographic algorithms.</p>
            
            <center>
              <a href="${
                process.env.FRONTEND_URL
              }/dashboard" class="button" style="color: #ffffff">Go to Dashboard</a>
            </center>
          </div>
          
          <div class="footer">
            <p>This is an automated email from Cypher-Ray. Please do not reply to this email.</p>
            <p>If you did not make this payment, please contact us immediately.</p>
            <p><strong>&copy; 2025 Cypher-Ray. All rights reserved.</strong></p>
          </div>
        </div>
      </body>
      </html>
    `,
    });

    if (result.data?.id) {
      console.log(
        `[EMAIL] ✅ Payment success email sent to ${email} (ID: ${result.data.id})`
      );
    } else {
      console.error(
        "[EMAIL] ❌ Payment email send failed - no confirmation ID received"
      );
    }
  } catch (error) {
    console.error(
      "[EMAIL] ❌ Failed to send payment success email:",
      error.message
    );
    console.error("[EMAIL] Email details:", {
      to: email,
      from: process.env.EMAIL_FROM,
    });
    // Don't throw error - email failure shouldn't stop payment flow
  }
};

/**
 * Send Payment Failed Email
 * @param {String} email - User email
 * @param {Object} failureDetails - Failure details
 */
export const sendPaymentFailedEmail = async (email, failureDetails) => {
  const { username, planName, amount, failureReason, attemptDate } =
    failureDetails;

  try {
    const result = await resend.emails.send({
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: "Payment Failed - Please Try Again | Cypher-Ray",
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            margin: 0;
            padding: 0;
            background-color: #f9fafb;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(45, 27, 71, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #dc2626 0%, #ea580c 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
          }
          .header h1 {
            margin: 10px 0;
            font-size: 28px;
            font-weight: 600;
          }
          .header p {
            margin: 0;
            font-size: 16px;
            opacity: 0.95;
          }
          .content {
            background: white;
            padding: 40px 30px;
          }
          .content p {
            color: #4b5563;
            margin: 0 0 15px 0;
            font-size: 15px;
          }
          .details {
            background: #fef3c7;
            padding: 24px;
            border-radius: 10px;
            margin: 24px 0;
            border: 2px solid #fbbf24;
          }
          .details-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #fde68a;
          }
          .details-row:last-child {
            border-bottom: none;
          }
          .label {
            font-weight: 600;
            color: #92400e;
            font-size: 14px;
          }
          .value {
            color: #78350f;
            text-align: right;
            font-weight: 500;
            font-size: 14px;
          }
          .reason {
            background: #fee2e2;
            border-left: 4px solid #dc2626;
            padding: 16px;
            border-radius: 6px;
            margin: 24px 0;
            color: #991b1b;
            font-weight: 500;
          }
          .button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #7c3aed 0%, #7808d0 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            margin-top: 24px;
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
          }
          .logo {
            max-width: 180px;
            height: auto;
            margin: 0 auto 20px auto;
            display: block;
          }
          .success-badge {
            background: #10b981;
            color: white;
            padding: 10px 24px;
            border-radius: 50px;
            font-weight: 600;
            font-size: 14px;
            display: inline-block;
            margin-bottom: 15px;
          }
          .failed-badge {
            background: #dc2626;
            color: white;
            padding: 10px 24px;
            border-radius: 50px;
            font-weight: 600;
            font-size: 14px;
            display: inline-block;
            margin-bottom: 15px;
          }
          .tips {
            background: #ede9fe;
            border-left: 4px solid #a855f7;
            padding: 20px;
            border-radius: 8px;
            margin: 24px 0;
          }
          .tips h3 {
            color: #6b21a8;
            margin: 0 0 12px 0;
            font-size: 16px;
          }
          .tips ul {
            margin: 0;
            padding-left: 20px;
            color: #4b5563;
          }
          .tips li {
            margin: 8px 0;
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
        <div class="container">
          <div class="header">
            <img src="${LOGO_URL}" alt="Cypher-Ray" class="logo" />
            <div class="failed-badge">Payment Failed</div>
            <h1>Payment Could Not Be Processed</h1>
          </div>
          
          <div class="content">
            <p>Hi ${username},</p>
            
            <p>We're sorry, but your recent payment attempt was unsuccessful. No charges have been made to your account.</p>
            
            <div class="details">
              <div class="details-row">
                <span class="label">Plan</span>
                <span class="value">${planName}</span>
              </div>
              <div class="details-row">
                <span class="label">Amount</span>
                <span class="value">₹${(amount / 100).toLocaleString(
                  "en-IN"
                )}</span>
              </div>
              <div class="details-row">
                <span class="label">Attempt Date</span>
                <span class="value">${new Date(attemptDate).toLocaleString(
                  "en-IN",
                  {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }
                )}</span>
              </div>
            </div>
            
            ${
              failureReason
                ? `
              <div class="reason">
                <strong>Reason:</strong> ${failureReason}
              </div>
            `
                : ""
            }
            
            <div class="tips">
              <h3>What to do next?</h3>
              <ul>
                <li>Check if you have sufficient balance in your account</li>
                <li>Verify your card details are correct</li>
                <li>Try using a different payment method (UPI, Net Banking, etc.)</li>
                <li>Contact your bank if the issue persists</li>
                <li>Ensure your card is enabled for online transactions</li>
              </ul>
            </div>
            
            <center>
              <a href="${
                process.env.FRONTEND_URL
              }/credits" class="button" style="color: #ffffff">Try Again</a>
            </center>
            
            <p style="margin-top: 30px; color: #4b5563;">If you continue to face issues, please don't hesitate to contact our support team. We're here to help!</p>
          </div>
          
          <div class="footer">
            <p>This is an automated email from Cypher-Ray. Please do not reply to this email.</p>
            <p>For support, please contact us at ${process.env.EMAIL_FROM}</p>
            <p><strong>&copy; 2025 Cypher-Ray. All rights reserved.</strong></p>
          </div>
        </div>
      </body>
      </html>
    `,
    });

    if (result.data?.id) {
      console.log(
        `[EMAIL] ✅ Payment failure email sent to ${email} (ID: ${result.data.id})`
      );
    } else {
      console.error(
        "[EMAIL] ❌ Payment failure email send failed - no confirmation ID received"
      );
    }
  } catch (error) {
    console.error(
      "[EMAIL] ❌ Failed to send payment failure email:",
      error.message
    );
    // Don't throw error - email failure shouldn't stop the flow
  }
};

export default {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
};