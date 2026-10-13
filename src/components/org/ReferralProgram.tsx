"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Copy, Share2, Trophy, Gift, IndianRupee, Users, Plus } from "lucide-react";
import { createReferral } from "@/app/actions/referrals";

interface ReferralProgramProps {
  academyName: string;
  totalStudents: number;
  referrals: any[];
  parents: any[];
}

export function ReferralProgram({ academyName, totalStudents, referrals, parents }: ReferralProgramProps) {
  const [referralCode, setReferralCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({ referrerId: '', refereePhone: '' });

  useEffect(() => {
    const shortName = academyName.substring(0, 6).toUpperCase().replace(/[^A-Z]/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    setReferralCode(`${shortName}-${random}`);
  }, [academyName]);

  const shareText = `🏆 Join ${academyName}! Use my referral code ${referralCode} and get ₹500 off your first month! Register at https://triqsports.vercel.app`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleCreateReferral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.referrerId || !form.refereePhone) return;
    startTransition(async () => {
      await createReferral(form.referrerId, form.refereePhone);
      setForm({ referrerId: '', refereePhone: '' });
    });
  };

  const totalDiscount = referrals.reduce((sum, r) => sum + (r.discount || 0), 0);

  const rewardTiers = [
    { referrals: 1, reward: "₹500 off next month", icon: <IndianRupee className="w-4 h-4" /> },
    { referrals: 3, reward: "1 month free", icon: <Gift className="w-4 h-4" /> },
    { referrals: 5, reward: "Free kit bag", icon: <Trophy className="w-4 h-4" /> },
    { referrals: 10, reward: "₹5,000 cash", icon: <IndianRupee className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-950 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle>Referral Program</CardTitle>
          <CardDescription className="text-zinc-400">Grow {academyName} and earn rewards!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-zinc-900/40 rounded-lg border border-zinc-800 text-center">
            <p className="text-sm text-zinc-400 mb-2">Your Unique Referral Code</p>
            <div className="text-3xl font-bold tracking-widest text-lime-400 mb-4">{referralCode}</div>
            <div className="flex gap-4 justify-center">
              <Button onClick={shareWhatsApp} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Share2 className="w-4 h-4 mr-2" /> Share via WhatsApp
              </Button>
              <Button variant="outline" onClick={copyToClipboard} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                <Copy className="w-4 h-4 mr-2" /> {copied ? "Copied!" : "Copy Link"}
              </Button>
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-zinc-900/40 rounded-lg border border-zinc-800">
            <div className="flex-1 flex flex-col items-center">
              <Users className="w-8 h-8 text-sky-400 mb-2" />
              <div className="text-2xl font-bold">{referrals.length}</div>
              <div className="text-xs text-zinc-500">Total Referrals</div>
            </div>
            <div className="w-px bg-zinc-800" />
            <div className="flex-1 flex flex-col items-center">
              <IndianRupee className="w-8 h-8 text-lime-400 mb-2" />
              <div className="text-2xl font-bold">₹{totalDiscount}</div>
              <div className="text-xs text-zinc-500">Discount Offered</div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900/40 rounded-lg border border-zinc-800">
            <h4 className="text-sm font-semibold mb-3 text-zinc-300">Log Manual Referral</h4>
            <form onSubmit={handleCreateReferral} className="flex gap-2">
              <select
                value={form.referrerId}
                onChange={e => setForm({...form, referrerId: e.target.value})}
                className="flex h-10 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                required
              >
                <option value="">Select Referrer (Parent)</option>
                {parents.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <Input
                placeholder="Referee Phone"
                value={form.refereePhone}
                onChange={e => setForm({...form, refereePhone: e.target.value})}
                className="flex-1 bg-zinc-900 border-zinc-700"
                required
              />
              <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" /> Add
              </Button>
            </form>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4 text-zinc-300">Recent Referrals</h4>
            <div className="space-y-3">
              {referrals.slice(0, 5).map((r, index) => (
                <div key={r.id || index} className="flex items-center p-3 bg-zinc-900/40 rounded-lg border border-zinc-800">
                  <div className="flex-1">
                    <p className="font-medium text-zinc-200">Referred by {r.referrer?.name}</p>
                    <p className="text-xs text-zinc-500">Phone: {r.refereePhone}</p>
                  </div>
                  <Badge variant={r.status === "CONVERTED" ? "default" : "outline"} className={r.status === "CONVERTED" ? "bg-emerald-600" : "text-amber-400 border-amber-400"}>
                    {r.status}
                  </Badge>
                </div>
              ))}
              {referrals.length === 0 && <p className="text-zinc-500 text-sm">No referrals yet.</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
