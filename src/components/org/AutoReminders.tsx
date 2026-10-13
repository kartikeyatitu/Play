'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import { getAutoReminders, markReminderSent, Reminder } from '@/app/actions/reminders'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { 
  MessageCircle, 
  CheckCheck, 
  Search, 
  ExternalLink, 
  Copy, 
  AlertTriangle, 
  Cake, 
  Calendar, 
  DollarSign, 
  UserCheck, 
  RefreshCw,
  Phone
} from 'lucide-react'

export function AutoReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({})

  const loadReminders = () => {
    startTransition(() => {
      getAutoReminders()
        .then((data) => setReminders(data))
        .catch(() => toast.error("Failed to load reminders"))
    })
  }

  useEffect(() => {
    loadReminders()
  }, [])

  const handleMarkSent = (type: string, phone: string, studentName: string) => {
    const key = `${type}-${phone}-${studentName}`
    setSentMap(prev => ({ ...prev, [key]: true }))
    
    startTransition(async () => {
      await markReminderSent(type, phone)
      toast.success(`Marked reminder as sent for ${studentName}`)
      setReminders(prev => prev.filter(r => !(r.type === type && r.parentPhone === phone && r.studentName === studentName)))
    })
  }

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Message copied to clipboard!")
  }

  // Categories config
  const categories = [
    { id: 'ALL', label: 'All Alerts', icon: RefreshCw },
    { id: 'SESSION_TOMORROW', label: 'Training', icon: Calendar, color: 'text-emerald-400' },
    { id: 'PROGRESS_UPDATE', label: 'Progress', icon: UserCheck, color: 'text-indigo-400' },
    { id: 'STREAK_MILESTONE', label: 'Streaks', icon: AlertTriangle, color: 'text-amber-400' },
    { id: 'BIRTHDAY', label: 'Birthdays', icon: Cake, color: 'text-purple-400' },
    { id: 'EVENT_REMINDER', label: 'Events', icon: Calendar, color: 'text-blue-400' },
    { id: 'TRIAL_FOLLOW_UP', label: 'Trials', icon: UserCheck, color: 'text-cyan-400' },
    { id: 'ABSENT_STREAK', label: 'Absences', icon: AlertTriangle, color: 'text-rose-400' },
    { id: 'FEE_DUE', label: 'Fees', icon: DollarSign, color: 'text-zinc-400' },
  ]

  const filteredReminders = useMemo(() => {
    return reminders.filter(r => {
      const matchesTab = activeTab === 'ALL' || r.type === activeTab
      const matchesSearch = 
        r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.parentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.parentPhone.includes(searchQuery)
      return matchesTab && matchesSearch
    })
  }, [reminders, activeTab, searchQuery])

  const countsByType = useMemo(() => {
    const counts: Record<string, number> = { ALL: reminders.length }
    for (const r of reminders) {
      counts[r.type] = (counts[r.type] || 0) + 1
    }
    return counts
  }, [reminders])

  return (
    <div className="space-y-6">
      {/* Header with Stats & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <MessageCircle className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Automated WhatsApp Reminders</h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            One-click direct WhatsApp messages generated from live fees, attendance streaks, and trial bookings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadReminders} 
            disabled={isPending}
            className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isPending ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            {reminders.length} Actionable Items
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map(cat => {
            const count = countsByType[cat.id] || 0
            const isActive = activeTab === cat.id
            const Icon = cat.icon
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  isActive 
                    ? 'bg-zinc-800 text-white border border-zinc-700 shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${cat.color || 'text-zinc-400'}`} />
                <span>{cat.label}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, parent, phone..." 
            className="pl-9 h-9 text-xs bg-zinc-900/70 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 rounded-xl"
          />
        </div>
      </div>

      {/* Reminder Cards Feed */}
      {isPending && reminders.length === 0 ? (
        <div className="p-12 text-center text-zinc-500 text-sm border border-zinc-800/50 rounded-2xl bg-zinc-950">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-600" />
          Scanning attendance, fee records, and trials...
        </div>
      ) : filteredReminders.length === 0 ? (
        <div className="p-12 text-center border border-zinc-800/50 rounded-2xl bg-zinc-900/20">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3 text-emerald-400">
            <CheckCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-zinc-200">All caught up!</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            {searchQuery 
              ? "No reminders match your search filter." 
              : "No pending reminders in this category today. Academy communications are up to date."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredReminders.map((r, i) => {
            const key = `${r.type}-${r.parentPhone}-${r.studentName}`
            const isSent = sentMap[key]

            const badgeMap: Record<string, { label: string; className: string }> = {
              SESSION_TOMORROW: { label: `🏟️ Training ${r.metadata?.sport || 'Session'}`, className: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' },
              PROGRESS_UPDATE: { label: `📈 Progress Update${r.metadata?.level ? ` · Level ${r.metadata.level}` : ''}`, className: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10' },
              STREAK_MILESTONE: { label: `🔥 ${r.metadata?.streak || ''}-Session Streak!`, className: 'border-amber-500/30 text-amber-400 bg-amber-500/10' },
              BIRTHDAY: { label: `🎂 Birthday ${r.metadata?.when || 'Wish'}`, className: 'border-purple-500/30 text-purple-400 bg-purple-500/10' },
              EVENT_REMINDER: { label: '📅 Event Reminder', className: 'border-blue-500/30 text-blue-400 bg-blue-500/10' },
              TRIAL_FOLLOW_UP: { label: '🏃 Trial Follow-up', className: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10' },
              ABSENT_STREAK: { label: `⚠️ ${r.metadata?.missedCount || 3} Sessions Missed`, className: 'border-rose-500/30 text-rose-400 bg-rose-500/10' },
              FEE_DUE: { label: `💰 Fee Due${r.metadata?.month ? ` (${r.metadata.month})` : ''}`, className: 'border-zinc-600/30 text-zinc-400 bg-zinc-600/10' },
            }
            const badge = badgeMap[r.type] || { label: r.type, className: 'border-zinc-700 text-zinc-400 bg-zinc-800' }
            const typeBadge = (
              <Badge variant="outline" className={`${badge.className} text-[10px]`}>
                {badge.label}
              </Badge>
            )

            return (
              <div 
                key={i} 
                className="group relative overflow-hidden rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all p-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Student, Parent & Message */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-zinc-100">{r.studentName}</span>
                      <span className="text-zinc-600 text-xs">•</span>
                      <span className="text-xs text-zinc-400">Parent: {r.parentName}</span>
                      <div className="flex items-center text-[11px] text-zinc-500 gap-1 bg-zinc-800/60 px-2 py-0.5 rounded-md">
                        <Phone className="w-3 h-3 text-zinc-400" />
                        <span>{r.parentPhone}</span>
                      </div>
                      {typeBadge}
                    </div>

                    {/* Pre-written WhatsApp Message Preview */}
                    <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-850 text-xs text-zinc-300 font-sans leading-relaxed">
                      {r.message}
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Send WhatsApp Button */}
                    <a
                      href={r.waLink}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => handleMarkSent(r.type, r.parentPhone, r.studentName)}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm active:scale-95"
                    >
                      <MessageCircle className="w-3.5 h-3.5 fill-white" />
                      Send WhatsApp
                      <ExternalLink className="w-3 h-3 opacity-70 ml-0.5" />
                    </a>

                    {/* Copy Text Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyMessage(r.message)}
                      className="h-9 px-2.5 border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-xs"
                      title="Copy text"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>

                    {/* Mark as Done / Sent */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkSent(r.type, r.parentPhone, r.studentName)}
                      className="h-9 px-3 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/80"
                    >
                      <CheckCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
