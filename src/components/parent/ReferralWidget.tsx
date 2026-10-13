"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createReferral, getReferralsCount } from "@/app/actions/referral"

export function ReferralWidget({ userId }: { userId: string }) {
  const [refereePhone, setRefereePhone] = useState("")
  const [copied, setCopied] = useState(false)
  const [convertedCount, setConvertedCount] = useState(0)

  const referralCode = userId.substring(0, 6).toUpperCase()
  const referralLink = `https://triqsports.vercel.app/join?ref=${referralCode}`

  useEffect(() => {
    getReferralsCount(userId).then(setConvertedCount)
  }, [userId])

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!refereePhone) return
    try {
      await createReferral(userId, refereePhone)
      setRefereePhone("")
      alert("Invitation sent!")
    } catch (err) {
      console.error(err)
      alert("Failed to send invitation.")
    }
  }

  return (
    <Card className="p-6 bg-zinc-900/40 border-zinc-800 text-zinc-100">
      <h3 className="text-lg font-bold mb-2">Refer a Friend</h3>
      <p className="text-sm text-zinc-400 mb-4">
        Share your code to get ₹500 off your next fee payment when they join!
      </p>

      <div className="flex items-center gap-2 mb-6">
        <div className="flex-1 bg-zinc-950 px-3 py-2 rounded-md border border-zinc-800 text-sm font-mono text-zinc-300">
          {referralLink}
        </div>
        <Button 
          variant="outline" 
          onClick={handleCopy}
          className="border-zinc-800 text-zinc-300 hover:bg-zinc-800"
        >
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>

      <form onSubmit={handleInvite} className="flex gap-2 mb-6">
        <Input 
          placeholder="Friend's Phone Number" 
          value={refereePhone}
          onChange={(e) => setRefereePhone(e.target.value)}
          className="bg-zinc-950 border-zinc-800 text-zinc-100 flex-1"
        />
        <Button type="submit" className="bg-lime-500 hover:bg-lime-600 text-zinc-950 font-medium">
          Send Invite
        </Button>
      </form>

      <div className="pt-4 border-t border-zinc-800/50">
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-400">Successful Referrals</span>
          <span className="font-bold text-emerald-400">{convertedCount}</span>
        </div>
      </div>
    </Card>
  )
}
