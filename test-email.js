import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const mailOptions = {
  from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
  to: "aadipatel1911@gmail.com",
  subject: "✅ Test Email - Razorpay Integration",
  text: "This is a test email to verify the payment email system works correctly.",
  html: `
    <h2>Email Configuration Test</h2>
    <p>If you're seeing this, the email system is working!</p>
    <p>Payment success emails should now work correctly.</p>
  `,
};

console.log("Sending test email...");
console.log("From:", mailOptions.from);
console.log("To:", mailOptions.to);

transporter
  .sendMail(mailOptions)
  .then(() => {
    console.log("✅ Email sent successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Email error:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  });
