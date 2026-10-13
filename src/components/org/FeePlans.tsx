"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createFeePlan, deleteFeePlan } from "@/app/actions/fee-plans";
import { Trash2 } from "lucide-react";
import { FeePlan } from "@prisma/client";

export function FeePlans({ initialPlans }: { initialPlans: FeePlan[] }) {
  const [plans, setPlans] = useState<FeePlan[]>(initialPlans);
  const [isAdding, setIsAdding] = useState(false);
  const [newPlan, setNewPlan] = useState({
    name: "",
    duration: 1,
    amount: 0,
    sport: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!newPlan.name || newPlan.amount <= 0 || newPlan.duration <= 0) return;
    setIsSubmitting(true);
    try {
      await createFeePlan(newPlan);
      // Optimistic update
      setPlans((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          name: newPlan.name,
          duration: newPlan.duration,
          amount: newPlan.amount,
          sport: newPlan.sport || null,
          isActive: true,
          orgId: null,
          createdAt: new Date(),
        },
      ]);
      setNewPlan({ name: "", duration: 1, amount: 0, sport: "" });
      setIsAdding(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Optimistic update
    setPlans((prev) => prev.filter((p) => p.id !== id));
    await deleteFeePlan(id);
  };

  // Find monthly base rate to calculate savings
  const monthlyPlan = plans.find((p) => p.duration === 1);
  const monthlyRate = monthlyPlan ? monthlyPlan.amount : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Fee Plans</h2>
          <p className="text-zinc-400">Manage payment structures and durations.</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "outline" : "default"}>
          {isAdding ? "Cancel" : "Add Plan"}
        </Button>
      </div>

      {isAdding && (
        <Card className="bg-zinc-900/40 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">New Fee Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Plan Name</label>
                <Input
                  value={newPlan.name}
                  onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                  placeholder="e.g. Annual Package"
                  className="bg-zinc-950 border-zinc-800 text-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Duration (Months)</label>
                <Input
                  type="number"
                  min="1"
                  value={newPlan.duration}
                  onChange={(e) => setNewPlan({ ...newPlan, duration: parseInt(e.target.value) || 1 })}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Amount (₹)</label>
                <Input
                  type="number"
                  min="0"
                  value={newPlan.amount}
                  onChange={(e) => setNewPlan({ ...newPlan, amount: parseFloat(e.target.value) || 0 })}
                  className="bg-zinc-950 border-zinc-800 text-zinc-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Sport (Optional)</label>
                <Input
                  value={newPlan.sport}
                  onChange={(e) => setNewPlan({ ...newPlan, sport: e.target.value })}
                  placeholder="e.g. Football"
                  className="bg-zinc-950 border-zinc-800 text-zinc-100"
                />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Saving..." : "Save Plan"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const savings = monthlyRate && plan.duration > 1 ? monthlyRate * plan.duration - plan.amount : 0;
          
          return (
            <Card key={plan.id} className="bg-zinc-900/40 border-zinc-800 relative overflow-hidden group">
              {savings > 0 && (
                <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-bl-lg">
                  Save ₹{savings.toLocaleString()}
                </div>
              )}
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-zinc-100">{plan.name}</CardTitle>
                    <CardDescription className="text-zinc-400">
                      {plan.duration} {plan.duration === 1 ? "month" : "months"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-rose-400"
                    onClick={() => handleDelete(plan.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-zinc-100">
                  ₹{plan.amount.toLocaleString()}
                </div>
                {plan.sport && (
                  <Badge variant="outline" className="mt-4 border-zinc-700 text-zinc-300">
                    {plan.sport}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
        {plans.length === 0 && !isAdding && (
          <div className="col-span-3 text-center py-12 text-zinc-500 bg-zinc-900/20 rounded-lg border border-zinc-800 border-dashed">
            No fee plans configured yet.
          </div>
        )}
      </div>
    </div>
  );
}
