import { Resend } from "resend";

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
      subject: "✅ Payment Successful - Credits Added | Cypher-Ray",
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: white;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .success-icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
          .details {
            background: #f0f7ff;
            padding: 20px;
            border-left: 4px solid #4CAF50;
            margin: 20px 0;
          }
          .details-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          .details-row:last-child {
            border-bottom: none;
          }
          .label {
            font-weight: bold;
            color: #666;
          }
          .value {
            color: #333;
            text-align: right;
          }
          .credits-highlight {
            background: #4CAF50;
            color: white;
            padding: 15px;
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 12px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="success-icon">✅</div>
            <h1>Payment Successful!</h1>
            <p>Your credits have been added</p>
          </div>
          
          <div class="content">
            <p>Hi ${username},</p>
            
            <p>Great news! Your payment has been successfully processed and <strong>${creditsAmount} credits</strong> have been added to your account.</p>
            
            <div class="credits-highlight">
              + ${creditsAmount} Credits Added
            </div>
            
            <div class="details">
              <div class="details-row">
                <span class="label">Plan</span>
                <span class="value">${planName}</span>
              </div>
              <div class="details-row">
                <span class="label">Credits</span>
                <span class="value">${creditsAmount}</span>
              </div>
              <div class="details-row">
                <span class="label">Amount Paid</span>
                <span class="value">₹${(amount / 100).toLocaleString(
                  "en-IN"
                )}</span>
              </div>
              <div class="details-row">
                <span class="label">Payment ID</span>
                <span class="value">${paymentId}</span>
              </div>
              <div class="details-row">
                <span class="label">Date & Time</span>
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
              }/dashboard" class="button">Go to Dashboard</a>
            </center>
            
            <div class="footer">
              <p>This is an automated email from Cypher-Ray. Please do not reply to this email.</p>
              <p>If you did not make this payment, please contact us immediately.</p>
              <p>&copy; 2025 Cypher-Ray. All rights reserved.</p>
            </div>
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

  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: "❌ Payment Failed - Please Try Again | Cypher-Ray",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
          }
          .header {
            background: linear-gradient(135deg, #f12711 0%, #f5af19 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: white;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .failed-icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
          .details {
            background: #fff3cd;
            padding: 20px;
            border-left: 4px solid #f44336;
            margin: 20px 0;
          }
          .details-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          .details-row:last-child {
            border-bottom: none;
          }
          .label {
            font-weight: bold;
            color: #666;
          }
          .value {
            color: #333;
            text-align: right;
          }
          .reason {
            background: #ffebee;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            color: #d32f2f;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 12px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 20px;
          }
          .tips {
            background: #e3f2fd;
            padding: 20px;
            border-radius: 5px;
            margin-top: 20px;
          }
          .tips h3 {
            color: #1976d2;
            margin-top: 0;
          }
          .tips ul {
            margin: 10px 0;
            padding-left: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="failed-icon">❌</div>
            <h1>Payment Failed</h1>
            <p>Your payment could not be processed</p>
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
              <h3>💡 What to do next?</h3>
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
              }/credits" class="button">Try Again</a>
            </center>
            
            <p style="margin-top: 30px;">If you continue to face issues, please don't hesitate to contact our support team. We're here to help!</p>
            
            <div class="footer">
              <p>This is an automated email from Cypher-Ray. Please do not reply to this email.</p>
              <p>For support, please contact us at ${process.env.EMAIL_FROM}</p>
              <p>&copy; 2025 Cypher-Ray. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await getTransporter().sendMail(mailOptions);
    console.log(`[EMAIL] Payment failure email sent to ${email}`);
  } catch (error) {
    console.error(
      "[EMAIL] Failed to send payment failure email:",
      error.message
    );
    // Don't throw error - email failure shouldn't stop the flow
  }
};

export default {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
};
