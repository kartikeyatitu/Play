"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateVerificationStep } from "@/app/actions/coach-verification";
import { CheckCircle, Clock, AlertTriangle, XCircle, Upload, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface VerificationStep {
  name: string;
  status: string;
  uploadUrl?: string;
  verifiedAt?: string;
}

interface Props {
  coachId: string;
  verified: boolean;
  verificationData: string | null;
}

function parseSteps(data: string | null): VerificationStep[] {
  const defaults: VerificationStep[] = [
    { name: "ID Proof (Aadhar/PAN)", status: "PENDING" },
    { name: "Coaching Certificate", status: "PENDING" },
    { name: "Background Check", status: "PENDING" },
    { name: "Experience Proof", status: "PENDING" },
    { name: "First Aid Certification", status: "PENDING" },
  ];
  if (!data) return defaults;
  try {
    const parsed = JSON.parse(data);
    return parsed.steps || defaults;
  } catch {
    return defaults;
  }
}

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  PENDING: { icon: Clock, color: "text-zinc-400", label: "Pending" },
  SUBMITTED: { icon: Upload, color: "text-amber-400", label: "Under Review" },
  VERIFIED: { icon: CheckCircle, color: "text-emerald-400", label: "Verified" },
  REJECTED: { icon: XCircle, color: "text-rose-400", label: "Rejected" },
};

export function CoachVerificationBanner({ coachId, verified, verificationData }: Props) {
  const steps = parseSteps(verificationData);
  const verifiedCount = steps.filter(s => s.status === "VERIFIED").length;
  const [expanded, setExpanded] = useState(false);
  const [uploadUrls, setUploadUrls] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  if (verified) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
        <span className="text-sm text-emerald-300 font-medium">Your profile is fully verified</span>
        <Badge variant="emerald" className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/30">5/5 Verified</Badge>
      </div>
    );
  }

  const handleSubmit = (stepName: string) => {
    const url = uploadUrls[stepName];
    if (!url) {
      toast.error("Please enter a document URL or drive link");
      return;
    }
    startTransition(async () => {
      try {
        await updateVerificationStep(coachId, stepName, { status: "SUBMITTED", uploadUrl: url });
        toast.success(`${stepName} submitted for review!`);
      } catch {
        toast.error("Could not submit. Please try again.");
      }
      setUploadUrls(prev => ({ ...prev, [stepName]: "" }));
    });
  };

  return (
    <Card className="bg-amber-500/5 border-amber-500/20">
      <CardContent className="p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-amber-300">Profile Verification Required</p>
              <p className="text-xs text-zinc-400">{verifiedCount}/5 documents verified — complete to get the ✅ badge</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className={`w-6 h-1.5 rounded-full ${
                    s.status === "VERIFIED" ? "bg-emerald-400" :
                    s.status === "SUBMITTED" ? "bg-amber-400" :
                    s.status === "REJECTED" ? "bg-rose-400" :
                    "bg-zinc-700"
                  }`}
                />
              ))}
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
          </div>
        </button>

        {expanded && (
          <div className="mt-4 space-y-3">
            {steps.map((step) => {
              const config = statusConfig[step.status] || statusConfig.PENDING;
              const Icon = config.icon;

              return (
                <div key={step.name} className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${config.color}`} />
                      <span className="text-sm text-zinc-200">{step.name}</span>
                    </div>
                    <Badge
                      variant={step.status === "VERIFIED" ? "emerald" : step.status === "REJECTED" ? "rose" : "outline"}
                      className="text-xs"
                    >
                      {config.label}
                    </Badge>
                  </div>

                  {step.status === "PENDING" || step.status === "REJECTED" ? (
                    <div className="mt-2 flex gap-2">
                      <Input
                        placeholder="Paste Google Drive / document link..."
                        value={uploadUrls[step.name] || ""}
                        onChange={(e) => setUploadUrls(prev => ({ ...prev, [step.name]: e.target.value }))}
                        className="bg-zinc-800 border-zinc-700 text-sm h-8"
                      />
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleSubmit(step.name)}
                        className="bg-amber-500 text-zinc-950 hover:bg-amber-600 h-8 text-xs font-medium"
                      >
                        Submit
                      </Button>
                    </div>
                  ) : step.status === "SUBMITTED" ? (
                    <p className="mt-1 text-xs text-zinc-500">Submitted — waiting for admin review</p>
                  ) : step.status === "VERIFIED" && step.verifiedAt ? (
                    <p className="mt-1 text-xs text-zinc-500">Verified on {new Date(step.verifiedAt).toLocaleDateString()}</p>
                  ) : null}

                  {step.status === "REJECTED" && (
                    <p className="mt-1 text-xs text-rose-400">Document was rejected. Please re-submit.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
