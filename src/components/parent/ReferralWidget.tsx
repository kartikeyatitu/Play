"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { createReferral, getReferralsCount } from "@/app/actions/referral"

/**
 * Parent "refer a family" card (flag growthTools). The referral converts when that family's child is enrolled at the
 * academy. No reward is promised: the academy decides how to thank referrers.
 * (The old shareable /join?ref= link was removed — nothing read the code, so it never credited anyone.)
 */
export function ReferralWidget({ userId }: { userId: string }) {
  const [refereePhone, setRefereePhone] = useState("")
  const [saving, setSaving] = useState(false)
  const [convertedCount, setConvertedCount] = useState(0)

  useEffect(() => {
    getReferralsCount(userId).then(setConvertedCount).catch(() => setConvertedCount(0))
  }, [userId])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!refereePhone) return
    setSaving(true)
    try {
      const res = await createReferral(userId, refereePhone)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      setRefereePhone("")
      toast.success("Thanks! The academy will see your referral when they join.")
    } catch {
      toast.error("Couldn't save the referral. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6 bg-zinc-900/40 border-zinc-800 text-zinc-100">
      <h3 className="text-lg font-bold mb-2">Refer a family</h3>
      <p className="text-sm text-zinc-400 mb-4">
        Know a family who&apos;d like to join? Add their mobile number. When their child enrols, the academy sees that you referred them.
      </p>

      <form onSubmit={handleInvite} className="flex gap-2 mb-6">
        <Input
          type="tel"
          inputMode="numeric"
          placeholder="Their 10-digit mobile number"
          value={refereePhone}
          onChange={(e) => setRefereePhone(e.target.value)}
          className="bg-zinc-950 border-zinc-800 text-zinc-100 flex-1"
        />
        <Button type="submit" disabled={saving} className="bg-lime-500 hover:bg-lime-600 text-zinc-950 font-medium">
          {saving ? "Saving…" : "Refer"}
        </Button>
      </form>

      <div className="pt-4 border-t border-zinc-800/50">
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-400">Families who joined</span>
          <span className="font-bold text-emerald-400">{convertedCount}</span>
        </div>
      </div>
    </Card>
  )
}
