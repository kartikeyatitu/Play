"use client";
import { useState } from "react";
import { markFeeAsPaid, reverseFeePayment } from "@/app/actions/fees";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function FeeToggle({
  studentId,
  month,
  initialStatus,
}: {
  studentId: string;
  month: string;
  initialStatus: string;
}) {
  const [loading, setLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(initialStatus === "PAID");

  async function handleToggle(nextChecked: boolean) {
    if (loading) return;
    setLoading(true);

    if (nextChecked) {
      // PENDING → PAID: safe, no confirmation.
      setIsPaid(true);
      const res = await markFeeAsPaid(studentId, month);
      if (!res.success) {
        setIsPaid(false);
        toast.error(res.error || "Could not mark as paid.");
      }
    } else {
      // PAID → PENDING: destructive, require reason + confirm.
      const reason = window.prompt(
        "Reverse this payment back to PENDING?\n\nEnter a reason (will be logged):",
      );
      if (!reason || reason.trim().length < 3) {
        toast.error("Reversal cancelled — a reason is required.");
        setLoading(false);
        return;
      }
      setIsPaid(false);
      const res = await reverseFeePayment(studentId, month, reason.trim());
      if (!res.success) {
        setIsPaid(true);
        toast.error(res.error || "Could not reverse payment.");
      } else {
        toast.success("Payment reversed.");
      }
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center space-x-2">
      <Switch
        checked={isPaid}
        onCheckedChange={handleToggle}
        disabled={loading}
        className={isPaid ? "bg-lime-400" : "bg-zinc-700"}
      />
      <Label className={`text-xs font-bold ${isPaid ? "text-lime-400" : "text-zinc-500"}`}>
        {isPaid ? "PAID" : "PENDING"}
      </Label>
    </div>
  );
}
