"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildUpiLink } from "@/lib/fees";

interface WhatsAppReminderProps {
  parentPhone: string;
  studentName: string;
  month: string;
  amount: number;
  /** Signs the message with the academy's own name (not "Triq") */
  academyName?: string | null;
  /** If set, includes a UPI payment link in the reminder */
  upiId?: string | null;
}

function formatMonthHuman(monthStr: string): string {
  if (!monthStr || !monthStr.includes("-")) return monthStr;
  const [y, m] = monthStr.split("-").map(Number);
  if (!y || !m) return monthStr;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function WhatsAppReminder({
  parentPhone,
  studentName,
  month,
  amount,
  academyName,
  upiId,
}: WhatsAppReminderProps) {
  const signature = academyName || "Academy Management";
  const formattedMonth = formatMonthHuman(month);
  const amountText = amount > 0 ? `the fee of ₹${amount.toLocaleString("en-IN")}` : "the monthly fee";
  const upiText = upiId
    ? `\n\nPay directly via UPI ID: ${upiId}${
        amount > 0
          ? `\nUPI Link: ${buildUpiLink({
              upiId,
              payeeName: signature,
              amount,
              note: `${studentName} fee ${formattedMonth}`,
            })}`
          : ""
      }`
    : "";
  const message = `Namaste! Gentle reminder that ${amountText} for ${studentName} (${formattedMonth}) is currently pending.${upiText}\n\nKindly complete the payment at your earliest convenience.\n— ${signature}`;

  // Clean phone number (Indian 10-digit gets 91 prefix)
  const cleanPhone = parentPhone.replace(/\D/g, "");
  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const link = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;

  return (
    <Button
      variant="outline"
      size="icon"
      className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/30 hover:text-emerald-300 border border-emerald-500/30 w-8 h-8 rounded-lg transition-all"
      onClick={() => window.open(link, "_blank")}
      title={`Send WhatsApp reminder for ${formattedMonth} fee`}
    >
      <MessageCircle className="w-4 h-4" />
    </Button>
  );
}
