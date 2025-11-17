import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

console.log("Sending test email with Resend...");
console.log("From:", process.env.EMAIL_FROM);
console.log("To:", "aadipatel1911@gmail.com");

resend.emails
  .send({
    from: `${process.env.EMAIL_FROM_NAME || "Cypher-Ray"} <${
      process.env.EMAIL_FROM
    }>`,
    to: "aadipatel1911@gmail.com",
    subject: "✅ Test Email - Resend Integration",
    html: `
      <h2>Email Configuration Test</h2>
      <p>If you're seeing this, the Resend email system is working!</p>
      <p>✅ Welcome emails will work</p>
      <p>✅ Payment success emails will work</p>
      <p>✅ Password reset emails will work</p>
      <hr>
      <p><strong>Migration Complete!</strong></p>
      <p>Emails now work in production (Render.com) using Resend API instead of Gmail SMTP.</p>
    `,
  })
  .then((result) => {
    console.log("✅ Email sent successfully!");
    console.log("Email ID:", result.data?.id);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Email error:", error.message);
    console.error("Full error:", error);
    console.error("\nTroubleshooting:");
    console.error("1. Check RESEND_API_KEY is set in .env");
    console.error("2. Verify EMAIL_FROM is verified in Resend dashboard");
    console.error(
      "3. For testing, use: onboarding@resend.dev or verify your domain"
    );
    process.exit(1);
  });
