'use client'

import { useState, useTransition } from "react"
import { updateVerificationStep, VerificationData, VerificationStatus } from "@/app/actions/coach-verification"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { CheckCircle, Clock, ShieldCheck, XCircle, FileUp, ExternalLink, RotateCcw } from "lucide-react"

interface Coach {
  id: string
  name: string | null
  phone: string | null
  verified: boolean
  verificationData?: string | null
}

interface CoachVerificationProps {
  coaches: Coach[]
}

interface VerificationStep {
  name: string
  status: VerificationStatus
  uploadUrl?: string
  verifiedAt?: string
}

const DEFAULT_STEPS: VerificationStep[] = [
  { name: 'ID Proof (Aadhar/PAN)', status: 'PENDING' },
  { name: 'Coaching Certificate', status: 'PENDING' },
  { name: 'Background Check', status: 'PENDING' },
  { name: 'Experience Proof', status: 'PENDING' },
  { name: 'First Aid Certification', status: 'PENDING' }
]

export function CoachVerification({ coaches: initialCoaches }: CoachVerificationProps) {
  const [coaches, setCoaches] = useState<Coach[]>(initialCoaches)
  const [isPending, startTransition] = useTransition()

  const handleStatusChange = (coachId: string, stepName: string, newStatus: VerificationStatus) => {
    // Optimistic local state update
    setCoaches(prev => prev.map(c => {
      if (c.id !== coachId) return c;
      let currentSteps = DEFAULT_STEPS;
      if (c.verificationData) {
        try {
          const parsed = JSON.parse(c.verificationData);
          if (parsed.steps) currentSteps = parsed.steps;
        } catch (e) {}
      }
      const updatedSteps = currentSteps.map(s => s.name === stepName ? { ...s, status: newStatus } : s);
      const isAllVerified = updatedSteps.every(s => s.status === 'VERIFIED');
      return {
        ...c,
        verified: isAllVerified,
        verificationData: JSON.stringify({ steps: updatedSteps })
      };
    }));

    startTransition(async () => {
      try {
        await updateVerificationStep(coachId, stepName, { status: newStatus });
        toast.success(`${stepName}: marked as ${newStatus}`);
      } catch (err: any) {
        toast.error("Failed to update status");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-950 border-zinc-800 text-zinc-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            Coach Verification System
          </CardTitle>
          <CardDescription className="text-zinc-400">Review 5-step verification documents submitted by academy coaches.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {coaches.length === 0 ? (
              <p className="text-sm text-zinc-500">No coaches found.</p>
            ) : (
              coaches.map((coach) => {
                let steps = DEFAULT_STEPS
                if (coach.verificationData) {
                  try {
                    const parsed = JSON.parse(coach.verificationData) as VerificationData
                    if (parsed.steps) {
                      steps = DEFAULT_STEPS.map(ds => {
                        const existing = parsed.steps.find(ps => ps.name === ds.name)
                        return existing || ds
                      })
                    }
                  } catch (e) {}
                }

                const verifiedCount = steps.filter(s => s.status === 'VERIFIED').length

                return (
                  <div key={coach.id} className="flex flex-col p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 gap-4">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-zinc-100 text-lg">{coach.name || "Unknown Coach"}</p>
                          {coach.verified ? (
                            <Badge variant="emerald" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              <CheckCircle className="h-3 w-3 mr-1" /> Fully Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-400 border-amber-500/20 bg-amber-500/10">
                              <Clock className="h-3 w-3 mr-1" /> {verifiedCount}/5 Verified
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-zinc-400 mt-1">{coach.phone || "No phone provided"}</p>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-32">
                        <div className="flex justify-between text-xs mb-1 text-zinc-400">
                          <span>Progress</span>
                          <span>{verifiedCount}/5</span>
                        </div>
                        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full transition-all duration-300"
                            style={{ width: `${(verifiedCount / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {steps.map(step => (
                        <div key={step.name} className="flex flex-col justify-between p-3 border border-zinc-800 rounded-md bg-zinc-950 gap-3">
                          <div className="space-y-1">
                            <div className="flex items-start justify-between">
                              <p className="text-sm font-medium">{step.name}</p>
                              {step.status === 'VERIFIED' && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
                              {step.status === 'PENDING' && <Clock className="h-4 w-4 text-zinc-500 shrink-0" />}
                              {step.status === 'SUBMITTED' && <FileUp className="h-4 w-4 text-amber-500 shrink-0" />}
                              {step.status === 'REJECTED' && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                            </div>

                            {/* View Document Link if submitted */}
                            {step.uploadUrl ? (
                              <a 
                                href={step.uploadUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="inline-flex items-center text-xs text-cyan-400 hover:text-cyan-300 underline mt-1 gap-1"
                              >
                                <ExternalLink className="w-3 h-3" /> View Submitted Document
                              </a>
                            ) : (
                              <p className="text-[11px] text-zinc-500">No document attached yet</p>
                            )}
                          </div>
                          
                          <div className="flex gap-1.5 flex-wrap pt-2 border-t border-zinc-850">
                            <Button 
                              size="sm" 
                              variant={step.status === 'VERIFIED' ? 'default' : 'outline'} 
                              className={`h-7 text-[11px] px-2.5 ${step.status === 'VERIFIED' ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-none' : 'border-zinc-700 text-zinc-300'}`}
                              onClick={() => handleStatusChange(coach.id, step.name, 'VERIFIED')}
                              disabled={isPending}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" /> Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant={step.status === 'REJECTED' ? 'destructive' : 'outline'}
                              className={`h-7 text-[11px] px-2.5 ${step.status === 'REJECTED' ? '' : 'border-zinc-700 text-rose-400 hover:bg-rose-500/10'}`}
                              onClick={() => handleStatusChange(coach.id, step.name, 'REJECTED')}
                              disabled={isPending}
                            >
                              <XCircle className="w-3 h-3 mr-1" /> Reject
                            </Button>
                            {step.status !== 'PENDING' && (
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="h-7 text-[10px] px-1.5 text-zinc-500 hover:text-zinc-300"
                                onClick={() => handleStatusChange(coach.id, step.name, 'PENDING')}
                                disabled={isPending}
                                title="Reset to pending"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
