"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isValidUpiId } from "@/lib/fees";
import { buildReminderMessage, type PayOption } from "@/lib/pay-link";

interface WhatsAppReminderProps {
  parentPhone: string;
  parentName?: string | null;
  studentName: string;
  month: string;
  amount: number;
  /** Signs the message with the academy's own name (not "Triq") */
  academyName?: string | null;
  /** If set and valid, includes a UPI deep link in the reminder */
  upiId?: string | null;
  /**
   * Pre-resolved Razorpay payment link URL. When provided, the reminder uses it instead of UPI.
   * (Server callers can compute this via `payOptionForFee`; the UI falls back to UPI otherwise.)
   */
  razorpayUrl?: string | null;
}

export function WhatsAppReminder({
  parentPhone,
  parentName,
  studentName,
  month,
  amount,
  academyName,
  upiId,
  razorpayUrl,
}: WhatsAppReminderProps) {
  const academy = academyName || "Academy Management";

  let pay: PayOption = { kind: "none" };
  if (razorpayUrl) {
    pay = { kind: "razorpay", url: razorpayUrl };
  } else if (upiId && isValidUpiId(upiId)) {
    pay = {
      kind: "upi",
      upi: upiId,
      amount: amount > 0 ? amount : undefined,
      payee: academy,
      note: `${studentName} fee ${month}`,
    };
  }

  const { text } = buildReminderMessage({
    parentName: parentName ?? null,
    studentName,
    amount,
    month,
    academyName: academy,
    pay,
  });

  // Clean phone number (Indian 10-digit gets 91 prefix)
  const cleanPhone = parentPhone.replace(/\D/g, "");
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const link = `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;

  return (
    <Button
      variant="outline"
      size="icon"
      className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300 border border-emerald-500/30 w-8 h-8 rounded-lg transition-all"
      onClick={() => window.open(link, "_blank")}
      title={`Send WhatsApp reminder for ${month} fee`}
    >
      <MessageCircle className="w-4 h-4" />
    </Button>
  );
}
