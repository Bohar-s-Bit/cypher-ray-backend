import dotenv from "dotenv";
import { sendPaymentSuccessEmail } from "./services/payment.email.service.js";

dotenv.config();

console.log("Sending test payment success email...\n");
console.log("Email config:");
console.log("  Host:", process.env.EMAIL_HOST);
console.log("  Port:", process.env.EMAIL_PORT);
console.log("  User:", process.env.EMAIL_USER);
console.log("");

const testPaymentDetails = {
  username: "aadipatel1911_0dki",
  planName: "Standard",
  creditsAmount: 500,
  amount: 450000, // in paise
  paymentId: "pay_test_123456789",
  transactionDate: new Date(),
};

sendPaymentSuccessEmail("aadipatel1911@gmail.com", testPaymentDetails)
  .then(() => {
    console.log("\n✅ Payment success email sent!");
    console.log("📧 Check inbox: aadipatel1911@gmail.com");
    console.log("\nEmail should contain:");
    console.log("  - Plan: Standard");
    console.log("  - Credits: 500");
    console.log("  - Amount: ₹4,500");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Failed to send email:", error.message);
    process.exit(1);
  });
