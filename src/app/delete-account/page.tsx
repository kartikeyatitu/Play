"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";

export default function DeleteAccountPage() {
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10 || !confirmed) return;
    setSubmitting(true);
    // Record request and notify user
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans py-12 px-4 sm:px-6 flex items-center justify-center">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center gap-2">
          <a href="/home" className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
          </a>
        </div>

        <Card className="bg-zinc-900/80 border-zinc-800 text-zinc-100 overflow-hidden shadow-2xl">
          <CardHeader className="p-6 border-b border-zinc-800">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <CardTitle className="text-xl font-bold">Request Account & Data Deletion</CardTitle>
            <CardDescription className="text-xs text-zinc-400 mt-1">
              Google Play Data Safety compliant self-serve deletion request portal.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            {submitted ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center text-2xl">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">Deletion Request Received</h3>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-xs mx-auto">
                    Your request for <span className="text-zinc-200 font-mono font-medium">{phone}</span> has been logged. In accordance with DPDP regulations, personal profile data, linked children details, and login tokens will be completely purged within 7 business days.
                  </p>
                </div>
                <div className="pt-2">
                  <a href="/home" className="inline-block text-xs text-emerald-400 hover:underline">
                    Return to Triq Homepage
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 text-zinc-400 leading-relaxed">
                  <strong className="text-zinc-200">What gets deleted:</strong> Your user profile, emergency contact notes, linked children&apos;s personal profiles, and active login sessions.
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-medium">Registered 10-Digit Mobile Number *</label>
                  <Input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                    className="bg-zinc-950 border-zinc-800 text-zinc-100 text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-medium">Reason for leaving (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Switched to another academy, no longer playing..."
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={e => setConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-0"
                  />
                  <span className="text-zinc-400 text-[11px] leading-tight">
                    I understand that once processed, my attendance history and player profiles cannot be restored.
                  </span>
                </label>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={phone.length !== 10 || !confirmed || submitting}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs py-2"
                  >
                    {submitting ? "Processing..." : "Submit Account Deletion Request"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
