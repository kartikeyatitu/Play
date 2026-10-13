"use client"

import { Button } from "@/components/ui/button"
import { generateMonthlyFees } from "@/app/actions/auto-fees"
import { useState } from "react"

export function GenerateFeesButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const handleGenerate = async () => {
    setLoading(true)
    setMessage("")
    try {
      const count = await generateMonthlyFees()
      setMessage(`Generated ${count} fee records. Students without a fee set (batch fee or academy default) were skipped.`)
    } catch (error) {
      setMessage("Failed to generate fees.")
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <Button 
        onClick={handleGenerate} 
        disabled={loading}
        className="w-fit"
      >
        {loading ? "Generating..." : "Generate Monthly Fees"}
      </Button>
      {message && <p className="text-sm text-zinc-400">{message}</p>}
    </div>
  )
}
