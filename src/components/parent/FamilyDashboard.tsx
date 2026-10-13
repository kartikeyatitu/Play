"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, CreditCard, Calendar, Star, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";

export function FamilyDashboard({ children }: { children: any[] }) {
  if (!children || children.length === 0) return null;

  // Calculate Family Stats
  const totalChildren = children.length;
  // Get unique sports
  const sports = new Set<string>();
  children.forEach(child => {
    child.enrollments?.forEach((e: any) => {
      if (e.batch?.sport) sports.add(e.batch.sport);
    });
  });
  const totalSports = sports.size;

  let totalDue = 0;
  let totalPaid = 0;
  
  const feeDetails = children.map(child => {
    const fee = child.feeRecords?.[0]; // Assuming latest is first or only
    const status = fee?.status === 'PAID' ? 'PAID' : 'PENDING';
    const amount = fee?.amount || 0; 
    if (status === 'PENDING') totalDue += amount;
    else totalPaid += amount;
    
    const sportName = child.enrollments?.[0]?.batch?.sport || 'Sport';
    return { id: child.id, name: child.name, sport: sportName, status, amount };
  });

  const grandTotal = totalDue + totalPaid;

  const handleWhatsAppPayment = () => {
    const text = encodeURIComponent(`Hi, I'd like to pay the pending family fees of ₹${totalDue}.`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // Assign colors for children
  const colors = [
    { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500', badge: 'sky' },
    { bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500', badge: 'purple' },
    { bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500', badge: 'emerald' },
    { bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500', badge: 'amber' },
    { bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500', badge: 'rose' },
  ];

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="space-y-6">
      {/* Family Summary Bar */}
      <Card className="bg-gradient-to-r from-zinc-900 to-zinc-900/50 border-zinc-800">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-800/50 rounded-full">
                <Users className="w-6 h-6 text-zinc-300" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-100">Your Family</h2>
                <p className="text-zinc-400 text-sm">
                  {totalChildren} Children Enrolled · {totalSports} {totalSports === 1 ? 'Sport' : 'Sports'} · ₹{totalDue.toLocaleString()} Due
                </p>
                <p className="text-zinc-500 text-xs mt-1">
                  {children.map(c => `${c.name} (${c.enrollments?.[0]?.batch?.sport || 'Enrolled'})`).join(' · ')}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Child Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {children.map((child, idx) => {
          const color = colors[idx % colors.length];
          // Real numbers computed server-side for this child's batches
          const totalSessions = child.attendanceSummary?.totalSessions ?? 0;
          const attended = child.attendanceSummary?.presentCount ?? (child.attendances?.filter((a: any) => a.isPresent).length || 0);
          const attendancePct = totalSessions > 0 ? Math.min(100, Math.round((attended / totalSessions) * 100)) : 0;
          const feeStatus = child.feeRecords?.[0]?.status === 'PAID' ? 'PAID' : 'PENDING';
          const feeAmount = child.feeRecords?.[0]?.amount || 0;
          // Latest coach rating = average of technique/fitness/discipline (1–5); 0 stars if not rated yet
          const latestReport = child.skillReports?.[0];
          const rating = latestReport
            ? Math.round(((latestReport.technique || 0) + (latestReport.fitness || 0) + (latestReport.discipline || 0)) / 3)
            : 0;

          return (
            <Card key={child.id} className="border-zinc-800 bg-zinc-950 flex flex-col">
              <CardContent className="p-5 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
                      {child.name}
                      {child.age && <span className="text-xs text-zinc-500 font-normal">{child.age} yrs</span>}
                    </h3>
                    <p className="text-sm text-zinc-400">
                      {child.enrollments?.[0]?.batch?.name || 'No Batch'}
                    </p>
                  </div>
                  <Badge variant={color.badge as any}>
                    {child.enrollments?.[0]?.batch?.sport || 'Sport'}
                  </Badge>
                </div>

                <div className="space-y-4">
                  {/* Attendance */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-zinc-400">Attendance (since joining)</span>
                      <span className="text-zinc-300">{attended}/{totalSessions} ({attendancePct}%)</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-1.5 rounded-full ${color.bg}`} style={{ width: `${Math.min(100, attendancePct)}%` }} />
                    </div>
                  </div>

                  {/* Fee */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Fee Status</span>
                    <span className={`font-medium flex items-center gap-1 ${feeStatus === 'PAID' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      ₹{feeAmount.toLocaleString()} {feeStatus === 'PAID' ? '✅' : '⚠️'}
                    </span>
                  </div>

                  {/* Skill */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Latest Rating</span>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
              <div className="p-4 border-t border-zinc-800/50 mt-auto">
                <Button variant="outline" className="w-full justify-between group border-zinc-800 hover:bg-zinc-900 text-zinc-300">
                  View Details
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Combined Fee Section & Calendar Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Combined Fee Section */}
        <Card className="border-zinc-800 bg-zinc-950 flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-zinc-100">
              <CreditCard className="w-5 h-5 text-zinc-400" />
              Family Billing — {format(now, 'MMMM yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 flex-1 flex flex-col">
            <div className="space-y-3 flex-1">
              {feeDetails.map((fee, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                  <div>
                    <p className="font-medium text-zinc-200">{fee.name} - {fee.sport}</p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <p className="font-medium text-zinc-200">₹{fee.amount.toLocaleString()}</p>
                    <p className="text-sm min-w-[80px] text-right">
                      {fee.status === 'PAID' ? (
                        <span className="text-emerald-400">PAID ✅</span>
                      ) : (
                        <span className="text-amber-400">PENDING ⚠️</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="pt-4 border-t border-zinc-800 mt-auto">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-400">Total</span>
                <span className="font-bold text-lg text-zinc-100">₹{grandTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm mb-6">
                <span className="text-zinc-500">Paid: <span className="text-emerald-400">₹{totalPaid.toLocaleString()}</span></span>
                <span className="text-zinc-500">Due: <span className="text-amber-400">₹{totalDue.toLocaleString()}</span></span>
              </div>

              {totalDue > 0 && (
                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                  onClick={handleWhatsAppPayment}
                >
                  Pay All Pending via WhatsApp
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Family Attendance Calendar */}
        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-zinc-100">
              <Calendar className="w-5 h-5 text-zinc-400" />
              Family Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={i} className="text-center text-xs font-medium text-zinc-500 py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                <div key={`pad-${i}`} className="p-2" />
              ))}
              
              {daysInMonth.map((day, i) => {
                const dayAttendances = children.map((child, idx) => {
                  const att = child.attendances?.find((a: any) => isSameDay(new Date(a.session?.date || a.date), day));
                  return {
                    childIdx: idx,
                    present: att?.isPresent || false,
                    exists: !!att
                  };
                }).filter(a => a.exists);

                return (
                  <div 
                    key={i} 
                    className={`aspect-square p-1 rounded-md border flex flex-col items-center justify-start gap-1
                      ${isSameDay(day, now) ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-950 border-zinc-800/50'}
                    `}
                  >
                    <span className={`text-xs ${isSameDay(day, now) ? 'text-zinc-100 font-bold' : 'text-zinc-400'}`}>
                      {format(day, 'd')}
                    </span>
                    <div className="flex flex-wrap justify-center gap-0.5 px-0.5">
                      {dayAttendances.map(a => (
                        <div 
                          key={a.childIdx} 
                          className={`w-1.5 h-1.5 rounded-full ${a.present ? colors[a.childIdx % colors.length].bg : 'bg-zinc-800'}`}
                          title={children[a.childIdx].name}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex flex-wrap gap-4 text-xs justify-center border-t border-zinc-800/50 pt-4">
              {children.map((child, idx) => (
                <div key={child.id} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${colors[idx % colors.length].bg}`} />
                  <span className="text-zinc-400">{child.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
