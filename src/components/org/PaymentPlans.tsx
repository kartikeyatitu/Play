"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Copy, Check, Sparkles, Layers } from "lucide-react";
import { toast } from "sonner";
import { createFeePlan, deleteFeePlan } from "@/app/actions/fee-plans";

export type FeePlanItem = {
  id: string;
  name: string;
  duration: number;
  amount: number;
  sport: string | null;
};

export function PaymentPlans({
  academyName = "Triq Academy",
  feePlans = [],
}: {
  academyName?: string;
  feePlans?: FeePlanItem[];
}) {
  const [plans, setPlans] = useState<FeePlanItem[]>(feePlans);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("3");
  const [amount, setAmount] = useState("");
  const [sport, setSport] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    const parsedDuration = parseInt(duration, 10);

    if (!name.trim()) {
      toast.error("Please enter a plan name.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      toast.error("Please select a valid duration.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createFeePlan({
        name: name.trim(),
        duration: parsedDuration,
        amount: parsedAmount,
        sport: sport.trim() || undefined,
      });

      if (res.success) {
        toast.success(`Fee plan "${name.trim()}" created!`);
        setIsAddOpen(false);
        setName("");
        setAmount("");
        setSport("");
        // Optimistic append until page revalidation
        setPlans((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            name: name.trim(),
            duration: parsedDuration,
            amount: parsedAmount,
            sport: sport.trim() || null,
          },
        ]);
      } else {
        toast.error(res.error || "Failed to create fee plan.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to create fee plan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, planName: string) => {
    if (!confirm(`Are you sure you want to deactivate "${planName}"?`)) return;

    try {
      const res = await deleteFeePlan(id);
      if (res.success) {
        toast.success(`"${planName}" deactivated.`);
        setPlans((prev) => prev.filter((p) => p.id !== id));
      } else {
        toast.error(res.error || "Could not delete plan.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete plan.");
    }
  };

  const handleCopyDetails = (plan: FeePlanItem) => {
    const text = `*${academyName} Fee Plan*\nPlan: ${plan.name} (${plan.duration} Month${plan.duration > 1 ? "s" : ""})\nAmount: ₹${plan.amount.toLocaleString("en-IN")}${plan.sport ? `\nSport: ${plan.sport}` : ""}\n\nTo enroll or pay, contact academy management.`;
    navigator.clipboard.writeText(text);
    setCopiedId(plan.id);
    toast.success("Copied plan details to clipboard for WhatsApp!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getDurationLabel = (m: number) => {
    if (m === 1) return "Monthly (1 mo)";
    if (m === 3) return "Quarterly (3 mos)";
    if (m === 6) return "Half-Yearly (6 mos)";
    if (m === 12) return "Annual (12 mos)";
    return `${m} Months`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">
          Structured packages parents can opt for (e.g. 3-month discounts, annual memberships).
        </p>
        <Button
          size="sm"
          onClick={() => setIsAddOpen(true)}
          className="bg-lime-400 hover:bg-lime-300 text-zinc-950 font-semibold text-xs h-8"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Plan
        </Button>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-lime-400" /> Create Fee Plan
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Define a term-based pricing package for your students.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="plan-name" className="text-xs text-zinc-300">Plan Name</Label>
                <Input
                  id="plan-name"
                  placeholder="e.g. Quarterly Cricket Coaching"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="plan-duration" className="text-xs text-zinc-300">Duration</Label>
                  <select
                    id="plan-duration"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-lime-400"
                  >
                    <option value="1">1 Month</option>
                    <option value="3">3 Months (Quarterly)</option>
                    <option value="6">6 Months (Half-Yearly)</option>
                    <option value="12">12 Months (Annual)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="plan-amount" className="text-xs text-zinc-300">Total Fee (₹)</Label>
                  <Input
                    id="plan-amount"
                    type="number"
                    min="1"
                    placeholder="e.g. 7000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-zinc-900 border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plan-sport" className="text-xs text-zinc-300">Sport (Optional)</Label>
                <Input
                  id="plan-sport"
                  placeholder="e.g. Cricket, Football, Swimming"
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddOpen(false)}
                  className="border-zinc-800 text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-lime-400 hover:bg-lime-300 text-zinc-950 font-semibold"
                >
                  {isSubmitting ? "Creating..." : "Save Plan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {plans.length === 0 ? (
        <Card className="bg-zinc-900/30 border-zinc-800/60 p-6 text-center">
          <Layers className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-zinc-300">No custom fee plans yet</p>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Create quarterly or annual packages to incentivize parents to pay upfront.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition flex flex-col justify-between"
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold text-zinc-100">{plan.name}</CardTitle>
                    <CardDescription className="text-xs text-zinc-400 mt-0.5">
                      {plan.sport ? `${plan.sport} · ` : ""}{getDurationLabel(plan.duration)}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="border-lime-500/30 bg-lime-500/10 text-lime-400 text-[10px]">
                    {plan.duration} mo{plan.duration > 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 pb-2">
                <div className="text-xl font-bold font-mono text-white">
                  ₹{plan.amount.toLocaleString("en-IN")}
                  <span className="text-xs font-normal text-zinc-500 ml-1.5">
                    (~₹{Math.round(plan.amount / plan.duration).toLocaleString("en-IN")}/mo)
                  </span>
                </div>
              </CardContent>
              <CardFooter className="p-3 pt-0 border-t border-zinc-800/40 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopyDetails(plan)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 h-7 px-2"
                >
                  {copiedId === plan.id ? (
                    <Check className="w-3 h-3 mr-1 text-lime-400" />
                  ) : (
                    <Copy className="w-3 h-3 mr-1 text-zinc-500" />
                  )}
                  {copiedId === plan.id ? "Copied" : "Share Info"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(plan.id, plan.name)}
                  className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-7 px-2"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
