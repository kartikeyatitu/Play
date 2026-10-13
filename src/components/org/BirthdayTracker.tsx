"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gift, MessageCircle, CalendarDays } from "lucide-react";

interface Student {
  id: string;
  name: string;
  dob?: Date | string | null;
  parent?: {
    phone?: string | null;
  } | null;
  [key: string]: any;
}

interface BirthdayTrackerProps {
  students: Student[];
  academyName?: string;
}

export function BirthdayTracker({ students, academyName = "Our Academy" }: BirthdayTrackerProps) {
  const { todays, thisWeek, thisMonth } = useMemo(() => {
    const now = new Date();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();
    
    // Set 'now' to start of today for week calculations
    const startOfToday = new Date(now.getFullYear(), todayMonth, todayDate);
    const startOfNextWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const validStudents = students.filter(s => s.dob);
    
    const todays = [];
    const thisWeek = [];
    const thisMonth = [];
    
    for (const student of validStudents) {
      if (!student.dob) continue;
      
      const dob = new Date(student.dob);
      if (isNaN(dob.getTime())) continue;
      
      const bMonth = dob.getMonth();
      const bDate = dob.getDate();
      
      // Calculate age they are turning this year
      const age = now.getFullYear() - dob.getFullYear();
      
      const bdayThisYear = new Date(now.getFullYear(), bMonth, bDate);
      
      const studentBday = {
        ...student,
        age,
        bdayThisYear,
      };
      
      if (bMonth === todayMonth && bDate === todayDate) {
        todays.push(studentBday);
      } else if (bdayThisYear > startOfToday && bdayThisYear <= startOfNextWeek) {
        thisWeek.push(studentBday);
      } else if (bMonth === todayMonth) {
        thisMonth.push(studentBday);
      }
    }
    
    return { 
      todays: todays.sort((a, b) => a.bdayThisYear.getTime() - b.bdayThisYear.getTime()), 
      thisWeek: thisWeek.sort((a, b) => a.bdayThisYear.getTime() - b.bdayThisYear.getTime()), 
      thisMonth: thisMonth.sort((a, b) => a.bdayThisYear.getTime() - b.bdayThisYear.getTime()) 
    };
  }, [students]);

  const allUpcoming = [...todays, ...thisWeek];
  
  const handleSendWish = (name: string, phone?: string | null) => {
    if (!phone) {
      alert("No parent phone number available.");
      return;
    }
    const message = `🎂 Happy Birthday ${name}! 🎉 Wishing you a fantastic year ahead. As a birthday treat, enjoy 10% off this month's fee! - ${academyName}`;
    const encoded = encodeURIComponent(message);
    // Formatting phone number to ensure it works with WhatsApp (remove non-digits)
    const formattedPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${formattedPhone}?text=${encoded}`, '_blank');
  };

  const renderStudent = (student: any, type: 'today' | 'week') => {
    let daysUntil = 0;
    if (type === 'week') {
      const diffTime = Math.abs(student.bdayThisYear.getTime() - new Date().setHours(0,0,0,0));
      daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    return (
      <div key={student.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50 hover:border-amber-500/30 transition-colors">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-100">{student.name}</span>
            {type === 'today' ? (
              <Badge variant="lime" className="bg-amber-500/20 text-amber-500 border-amber-500/20">
                🎂 Today!
              </Badge>
            ) : (
              <Badge variant="outline" className="text-zinc-400">
                In {daysUntil} days
              </Badge>
            )}
          </div>
          <span className="text-xs text-zinc-500">
            Turning {student.age} • {student.bdayThisYear.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:text-amber-400 border-amber-500/20"
          onClick={() => handleSendWish(student.name, student.parent?.phone)}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Send Wish</span>
        </Button>
      </div>
    );
  };

  return (
    <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-amber-500">Birthday Tracker</CardTitle>
        </div>
        <CardDescription>Keep track of student birthdays and send special wishes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {allUpcoming.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
              No birthdays this week 🎈
            </div>
          ) : (
            <div className="space-y-2">
              {todays.map(s => renderStudent(s, 'today'))}
              {thisWeek.map(s => renderStudent(s, 'week'))}
            </div>
          )}
          
          {thisMonth.length > 0 && (
            <div className="pt-2">
              <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Later this month ({thisMonth.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {thisMonth.map(student => (
                  <Badge key={student.id} variant="outline" className="text-zinc-400 border-zinc-800">
                    {student.name} • {student.bdayThisYear.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
