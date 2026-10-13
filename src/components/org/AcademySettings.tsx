"use client";

import { useState } from "react";
import { updateAcademy, updateAcademyPayments } from "@/app/actions/academy";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RazorpayConnect } from "@/components/org/RazorpayConnect";

export function AcademySettings({ org }: { org: any }) {
  const [loading, setLoading] = useState(false);
  const [savingPayments, setSavingPayments] = useState(false);

  const handlePaymentsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingPayments(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await updateAcademyPayments(formData);
      if (res.success) toast.success("Payment settings saved!");
      else toast.error(res.error || "Failed to save payment settings");
    } catch (err: any) {
      toast.error(err.message || "Failed to save payment settings");
    } finally {
      setSavingPayments(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await updateAcademy(org.id, formData);
      toast.success("Academy profile updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update academy profile");
    } finally {
      setLoading(false);
    }
  };

  if (!org) return null;

  return (
    <div className="space-y-6">
    <Card className="bg-zinc-900/30 border-zinc-800/50 p-6">
      <h3 className="text-lg font-semibold text-white mb-1">Payments &amp; Fees</h3>
      <p className="text-xs text-zinc-500 mb-4">
        Parents pay directly to your UPI ID. Fee used for a student: student override → batch fee → default fee below.
      </p>
      <form onSubmit={handlePaymentsSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">UPI ID</label>
            <Input name="upiId" defaultValue={org.upiId || ""} placeholder="academy@okicici" className="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Default monthly fee (₹)</label>
            <Input name="defaultMonthlyFee" type="number" min={0} step={1} defaultValue={org.defaultMonthlyFee ?? ""} placeholder="e.g. 2000" className="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Coach pay per session (₹)</label>
            <Input name="coachSessionRate" type="number" min={0} step={1} defaultValue={org.coachSessionRate ?? ""} placeholder="Optional" className="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={savingPayments} className="bg-cyan-500 text-zinc-950 hover:bg-cyan-600 font-bold">
            {savingPayments ? "Saving..." : "Save Payment Settings"}
          </Button>
        </div>
      </form>
    </Card>

    <RazorpayConnect />

    <Card className="bg-zinc-900/30 border-zinc-800/50 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Academy Profile Details</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Academy Name *</label>
            <Input name="name" defaultValue={org.name} required className="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Primary Sport</label>
            <Input name="sport" defaultValue={org.sport || ""} className="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">City *</label>
            <Input name="city" defaultValue={org.city} required className="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">State *</label>
            <Input name="state" defaultValue={org.state} required className="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Full Address</label>
            <Input name="address" defaultValue={org.address || ""} className="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">PIN Code</label>
            <Input name="pincode" defaultValue={org.pincode || ""} placeholder="e.g. 560001" maxLength={6} className="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Contact Phone</label>
            <Input name="phone" defaultValue={org.phone || ""} className="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Contact Email</label>
            <Input name="email" type="email" defaultValue={org.email || ""} className="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs text-zinc-400">Logo URL</label>
            <Input name="logo" defaultValue={org.logo || ""} placeholder="https://example.com/logo.png" className="bg-zinc-950 border-zinc-800 text-zinc-100" />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={loading} className="bg-cyan-500 text-zinc-950 hover:bg-cyan-600 font-bold">
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Card>
    </div>
  );
}
