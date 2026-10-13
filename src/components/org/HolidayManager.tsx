"use client"

import { useState, useEffect } from "react"
import { addHoliday, getHolidays } from "@/app/actions/holidays"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"


export function HolidayManager() {
  const [holidays, setHolidays] = useState<any[]>([])
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadHolidays = async () => {
    const data = await getHolidays()
    setHolidays(data)
  }

  useEffect(() => {
    loadHolidays()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !date) return
    setIsSubmitting(true)
    try {
      await addHoliday(title, date)
      setTitle("")
      setDate("")
      await loadHolidays()
    } catch (err) {
      console.error(err)
      alert("Failed to add holiday")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="p-6 bg-zinc-900/40 border-zinc-800 text-zinc-100">
      <h2 className="text-xl font-bold mb-6">Manage Holidays</h2>
      
      <form onSubmit={handleSubmit} className="flex gap-4 items-end mb-8">
        <div className="flex-1">
          <label className="block text-sm text-zinc-400 mb-1">Holiday Title</label>
          <Input 
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Diwali, Christmas"
            className="bg-zinc-950 border-zinc-800 text-zinc-100"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-zinc-400 mb-1">Date</label>
          <Input 
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-zinc-950 border-zinc-800 text-zinc-100 [color-scheme:dark]"
          />
        </div>
        <Button 
          type="submit" 
          disabled={isSubmitting}
          className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
        >
          {isSubmitting ? "Adding..." : "Add Holiday"}
        </Button>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider">Upcoming Holidays</h3>
        {holidays.length === 0 ? (
          <p className="text-zinc-500 text-sm">No holidays configured yet.</p>
        ) : (
          <div className="space-y-2">
            {holidays.map((h) => (
              <div 
                key={h.id} 
                className="flex justify-between items-center p-4 rounded-md bg-zinc-950 border border-zinc-800"
              >
                <div className="font-medium text-zinc-200">{h.title}</div>
                <div className="text-sm text-zinc-400">
                  {new Date(h.date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
