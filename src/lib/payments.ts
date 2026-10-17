// Unified Payment Gateway Configuration
// Supports both Razorpay (India) and Stripe (International)
//
// IMPORTANT: the RAZORPAY_* / STRIPE_* keys below are Triq's OWN platform accounts. They are for
// Triq's SaaS billing, never for academy fees: collecting academy money into the platform account
// makes Triq a payment aggregator under RBI rules. Academy fees go through each academy's own
// connected Razorpay (src/lib/razorpay-org.ts, src/app/actions/razorpay-connect.ts); platform-account
// fee collection is only possible with PLATFORM_COLLECTS_FEES explicitly on (default off).

// ─── Provider Detection ───
export type PaymentProvider = "razorpay" | "stripe" | "manual";

/** Mirrors platformCollectsFees() in gateways/stripe.ts (kept inline so this module stays import-free). */
const PLATFORM_COLLECTS_FEES = /^(1|true|yes)$/i.test((process.env.PLATFORM_COLLECTS_FEES || "").trim());

/** Provider for collecting a FEE with platform keys. "manual" (UPI / payment links) unless explicitly allowed. */
export function getPaymentProvider(country: string = "IN"): PaymentProvider {
  if (!PLATFORM_COLLECTS_FEES) return "manual";
  if (country === "IN" && RAZORPAY_CONFIG.isConfigured) return "razorpay";
  if (country !== "IN" && STRIPE_CONFIG.isConfigured) return "stripe";
  if (RAZORPAY_CONFIG.isConfigured) return "razorpay";
  if (STRIPE_CONFIG.isConfigured) return "stripe";
  return "manual"; // Fallback: WhatsApp payment links
}

// ─── Razorpay (India) — Triq platform account ───
export const RAZORPAY_CONFIG = {
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
  webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  currency: "INR",
  isConfigured: !!process.env.RAZORPAY_KEY_ID,
};

// ─── Stripe (International) ───
export const STRIPE_CONFIG = {
  publishable_key: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
  secret_key: process.env.STRIPE_SECRET_KEY || "",
  webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || "",
  isConfigured: !!process.env.STRIPE_SECRET_KEY,
};

// ─── Supported Currencies ───
export const CURRENCIES: Record<string, { symbol: string; code: string; provider: PaymentProvider }> = {
  IN: { symbol: "₹", code: "INR", provider: "razorpay" },
  US: { symbol: "$", code: "USD", provider: "stripe" },
  GB: { symbol: "£", code: "GBP", provider: "stripe" },
  AE: { symbol: "AED", code: "AED", provider: "stripe" },
  SG: { symbol: "S$", code: "SGD", provider: "stripe" },
  AU: { symbol: "A$", code: "AUD", provider: "stripe" },
  CA: { symbol: "C$", code: "CAD", provider: "stripe" },
  EU: { symbol: "€", code: "EUR", provider: "stripe" },
};

export function getCurrency(country: string = "IN") {
  return CURRENCIES[country] || CURRENCIES["US"];
}

// ─── Unified Payment Order ───
export interface PaymentOrder {
  id: string;
  provider: PaymentProvider;
  studentId: string;
  studentName: string;
  amount: number;
  currency: string;
  month: string;
  status: "created" | "paid" | "failed" | "refunded";
  providerOrderId?: string; // razorpay order_id or stripe payment_intent id
  providerPaymentId?: string;
  createdAt: Date;
}

// ─── Payment Methods by Country ───
export function getPaymentMethods(country: string = "IN") {
  if (country === "IN") {
    return [
      { id: "upi", name: "UPI", icon: "📱", description: "GPay, PhonePe, Paytm, BHIM" },
      { id: "card", name: "Debit/Credit Card", icon: "💳", description: "Visa, Mastercard, RuPay" },
      { id: "netbanking", name: "Net Banking", icon: "🏦", description: "All major banks" },
      { id: "wallet", name: "Wallets", icon: "👛", description: "Paytm, Mobikwik, Freecharge" },
      { id: "emandate", name: "Auto-Pay (e-NACH)", icon: "🔄", description: "Monthly auto-debit" },
    ];
  }
  return [
    { id: "card", name: "Credit/Debit Card", icon: "💳", description: "Visa, Mastercard, Amex" },
    { id: "bank", name: "Bank Transfer", icon: "🏦", description: "ACH / SEPA" },
    { id: "apple_pay", name: "Apple Pay", icon: "🍎", description: "Pay with Apple Pay" },
    { id: "google_pay", name: "Google Pay", icon: "📱", description: "Pay with Google Pay" },
  ];
}

// ─── Setup Instructions ───
export const SETUP_INSTRUCTIONS = {
  razorpay: {
    name: "Razorpay",
    steps: [
      "Sign up at razorpay.com",
      "Go to Dashboard → Settings → API Keys",
      "Generate test keys (instant) or live keys (after KYC)",
      "Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env",
      "Set up webhook at Dashboard → Webhooks → Add URL: /api/webhooks/razorpay",
    ],
    envVars: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"],
    pricing: "2% per transaction (UPI: ~0.3%)",
    settlement: "T+2 business days",
  },
  stripe: {
    name: "Stripe",
    steps: [
      "Sign up at stripe.com",
      "Go to Dashboard → Developers → API Keys",
      "Copy Publishable key and Secret key",
      "Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY to .env",
      "Set up webhook at Dashboard → Webhooks → Add endpoint: /api/webhooks/stripe",
    ],
    envVars: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    pricing: "2.9% + 30¢ per transaction",
    settlement: "T+2 business days (T+7 for new accounts)",
  },
};
