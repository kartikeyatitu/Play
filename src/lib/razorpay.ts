// Razorpay configuration - plug in real keys when ready
export const RAZORPAY_CONFIG = {
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_PLACEHOLDER",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
  currency: "INR",
  company_name: "Triq",
  description: "Sports Academy Fee Payment",
  // Set to true when real keys are configured
  isConfigured: !!process.env.RAZORPAY_KEY_ID,
};

export interface PaymentOrder {
  id: string;
  studentId: string;
  studentName: string;
  amount: number; // in paise (2500 rupees = 250000 paise)
  month: string;
  status: "created" | "paid" | "failed";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: Date;
}
