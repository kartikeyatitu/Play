"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface AttendanceRecord {
  isPresent: boolean;
  session: { date: string };
}

export function AttendanceCalendar({ attendances }: { attendances: AttendanceRecord[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  
  // Make Monday = 0
  const emptyDaysStart = (firstDayOfMonth + 6) % 7; 

  const getAttendanceForDate = (day: number) => {
    const dateStr = new Date(year, month, day).toISOString().split('T')[0];
    return attendances.find(a => a.session.date.startsWith(dateStr));
  };

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  
  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  };
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="bg-zinc-900/50 border-zinc-800/50 border rounded-xl p-4 w-full max-w-md">
      <div className="flex justify-between items-center mb-4">
        <button onClick={prevMonth} className="p-1 hover:bg-zinc-800 rounded">
          <ChevronLeft className="w-5 h-5 text-zinc-400" />
        </button>
        <h2 className="font-medium text-zinc-100">
          {monthNames[month]} {year}
        </h2>
        <button onClick={nextMonth} className="p-1 hover:bg-zinc-800 rounded">
          <ChevronRight className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => (
          <div key={day} className="text-xs font-medium text-zinc-500 py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: emptyDaysStart }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10 rounded-md bg-transparent" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const attendance = getAttendanceForDate(day);
          const today = isToday(day);
          
          return (
            <div 
              key={`day-${day}`}
              className={`h-10 rounded-md flex flex-col items-center justify-center relative ${today ? 'ring-2 ring-zinc-500' : ''}`}
            >
              <span className="text-sm text-zinc-300">{day}</span>
              {attendance && (
                <div className={`w-1.5 h-1.5 rounded-full absolute bottom-1.5 ${attendance.isPresent ? 'bg-emerald-500' : 'bg-red-500'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
