"use client"

import { useState } from "react"
import { bookTrial } from "@/app/actions/trial"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

export function TrialClient({ batches, org, initialBatchId }: { batches: any[], org: any, initialBatchId?: string }) {
  const [parentName, setParentName] = useState("")
  const [parentPhone, setParentPhone] = useState("")
  const [childName, setChildName] = useState("")
  const [childAge, setChildAge] = useState("")
  const [batchId, setBatchId] = useState(initialBatchId && batches.some((b) => b.id === initialBatchId) ? initialBatchId : "")
  const [date, setDate] = useState("")
  const [message, setMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await bookTrial(parentName, parentPhone, childName, parseInt(childAge, 10), batchId, date)
      setMessage("Trial booked! The academy will confirm shortly.")
      setParentName("")
      setParentPhone("")
      setChildName("")
      setChildAge("")
      setBatchId("")
      setDate("")
    } catch (err) {
      console.error(err)
      setMessage("Failed to book trial. Please try again.")
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-8 flex justify-center items-center text-zinc-100">
      <Card className="w-full max-w-md p-6 bg-zinc-900/40 border-zinc-800">
        <h1 className="text-2xl font-bold mb-1 text-zinc-100">Book a Free Trial Class</h1>
        <p className="text-sm text-zinc-400 mb-4">at {org.name}</p>
        
        {message ? (
          <div className="p-4 bg-emerald-500/20 text-emerald-400 rounded-md mb-4 border border-emerald-500/50">
            {message}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Parent Name</label>
            <Input 
              required 
              value={parentName} 
              onChange={e => setParentName(e.target.value)} 
              className="bg-zinc-950 border-zinc-800 text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Parent Phone</label>
            <Input 
              required 
              value={parentPhone} 
              onChange={e => setParentPhone(e.target.value)} 
              className="bg-zinc-950 border-zinc-800 text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Child Name</label>
            <Input 
              required 
              value={childName} 
              onChange={e => setChildName(e.target.value)} 
              className="bg-zinc-950 border-zinc-800 text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Child Age</label>
            <Input 
              required 
              type="number" 
              value={childAge} 
              onChange={e => setChildAge(e.target.value)} 
              className="bg-zinc-950 border-zinc-800 text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Select Batch</label>
            <select 
              required 
              value={batchId} 
              onChange={e => setBatchId(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-transparent"
            >
              <option value="">-- Choose a Batch --</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} - {b.sport} ({b._count?.enrollments || 0} enrolled)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Preferred Date</label>
            <Input 
              required 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              className="bg-zinc-950 border-zinc-800 text-zinc-100 [color-scheme:dark]"
            />
          </div>
          <Button type="submit" className="w-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200">
            Book Trial
          </Button>
        </form>
      </Card>
    </div>
  )
}
