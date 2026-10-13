"use client";
import { useState } from "react";
import { toggleFeeStatus } from "@/app/actions/fees";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function FeeToggle({ studentId, month, initialStatus }: { studentId: string, month: string, initialStatus: string }) {
  const [loading, setLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(initialStatus === "PAID");

  async function handleToggle() {
    setLoading(true);
    const newStatus = !isPaid;
    setIsPaid(newStatus); // Optimistic update
    await toggleFeeStatus(studentId, month);
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
      <Label className={`text-xs font-bold ${isPaid ? 'text-lime-400' : 'text-zinc-500'}`}>
        {isPaid ? "PAID" : "PENDING"}
      </Label>
    </div>
  );
}
