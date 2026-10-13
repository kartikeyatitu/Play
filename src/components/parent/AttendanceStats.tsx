"use client"

type Attendance = {
  isPresent: boolean
}

export function AttendanceStats({ attendances, totalSessions, presentCount }: { attendances: Attendance[], totalSessions: number, presentCount?: number }) {
  // Prefer the server-computed present count; `attendances` may be a truncated recent list
  const attended = presentCount ?? attendances.filter(a => a.isPresent).length
  const percentage = totalSessions > 0 ? Math.min(100, Math.round((attended / totalSessions) * 100)) : 0
  
  let colorClass = "bg-rose-500"
  if (percentage >= 80) colorClass = "bg-emerald-500"
  else if (percentage >= 60) colorClass = "bg-amber-500"

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4 w-full max-w-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-zinc-100">Attendance</h3>
        <span className="text-sm text-zinc-400">{attended}/{totalSessions} sessions ({percentage}%)</span>
      </div>
      <div className="h-3 w-full bg-zinc-900 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClass} transition-all duration-300`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
