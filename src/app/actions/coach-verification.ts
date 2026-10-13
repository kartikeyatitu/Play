'use server'

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth";
import { safeHttpUrl } from "@/lib/safe-url";

export type VerificationStatus = 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED'

export interface VerificationStep {
  name: string
  status: VerificationStatus
  uploadUrl?: string
  verifiedAt?: string
}

export interface VerificationData {
  steps: VerificationStep[]
}

const DEFAULT_STEPS: VerificationStep[] = [
  { name: 'ID Proof (Aadhar/PAN)', status: 'PENDING' },
  { name: 'Coaching Certificate', status: 'PENDING' },
  { name: 'Background Check', status: 'PENDING' },
  { name: 'Experience Proof', status: 'PENDING' },
  { name: 'First Aid Certification', status: 'PENDING' }
]

// Tenant/role scope: coaches can only access their own record; admins any coach in their academy.
async function findAccessibleCoach(session: { id: string; role: string; orgId: string | null }, coachId: string) {
  if (session.role === "COACH") {
    if (coachId !== session.id) return null;
    return db.user.findUnique({ where: { id: session.id } })
  }
  return db.user.findFirst({ where: { id: coachId, orgId: session.orgId || "__no_org__" } })
}

function parseVerification(verificationData: string | null): VerificationData {
  if (verificationData) {
    try {
      const data = JSON.parse(verificationData) as VerificationData
      // Ensure all steps exist
      const steps = [...data.steps]
      for (const defaultStep of DEFAULT_STEPS) {
        if (!steps.find(s => s.name === defaultStep.name)) {
          steps.push(defaultStep)
        }
      }
      return { steps }
    } catch (e) {
      return { steps: DEFAULT_STEPS.map(s => ({ ...s })) }
    }
  }
  
  return { steps: DEFAULT_STEPS.map(s => ({ ...s })) }
}

export async function getCoachVerification(coachId: string): Promise<VerificationData> {
    const session = await requireAuth(['ADMIN', 'COACH']);
  const coach = await findAccessibleCoach(session, coachId)
  
  if (!coach) throw new Error("Coach not found")
  
  return parseVerification(coach.verificationData)
}

export async function updateVerificationStep(coachId: string, stepName: string, data: Partial<VerificationStep>) {
    const session = await requireAuth(['ADMIN', 'COACH']);
  const coach = await findAccessibleCoach(session, coachId)
  if (!coach) throw new Error("Coach not found")

  // Whitelist fields. Coaches may only submit documents for review — they cannot verify themselves.
  // uploadUrl is later rendered as a link for the admin, so only absolute http(s) URLs are stored.
  if (data?.uploadUrl !== undefined && data.uploadUrl !== "" && !safeHttpUrl(data.uploadUrl)) {
    throw new Error("Please enter a valid http(s) link")
  }
  const patch: Partial<VerificationStep> = {}
  if (session.role === "COACH") {
    if (data?.status && data.status !== "SUBMITTED" && data.status !== "PENDING") {
      throw new Error("Not allowed")
    }
    if (data?.status) patch.status = data.status
    if (data?.uploadUrl !== undefined) patch.uploadUrl = data.uploadUrl
  } else {
    if (data?.status) patch.status = data.status
    if (data?.uploadUrl !== undefined) patch.uploadUrl = data.uploadUrl
    if (data?.verifiedAt !== undefined) patch.verifiedAt = data.verifiedAt
  }

  const currentData = parseVerification(coach.verificationData)
  
  const stepIndex = currentData.steps.findIndex(s => s.name === stepName)
  if (stepIndex >= 0) {
    currentData.steps[stepIndex] = { ...currentData.steps[stepIndex], ...patch }
    
    // Check if all verified
    const allVerified = currentData.steps.length === 5 && currentData.steps.every(s => s.status === 'VERIFIED')
    
    await db.user.update({
      where: { id: coach.id },
      data: {
        verificationData: JSON.stringify(currentData),
        verified: allVerified
      }
    })
    
    revalidatePath('/coach'); revalidatePath('/org')
  }
}
