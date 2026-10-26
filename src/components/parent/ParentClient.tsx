'use client';
import { Suspense, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { PaymentReturnHandler } from '@/components/parent/PaymentReturnHandler';
import { DashboardShell, SectionHeader, NAV_ICONS } from '@/components/ui/dashboard-shell';
import { CheckoutModal } from '@/components/parent/CheckoutModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut } from 'lucide-react';
import { FamilyDashboard } from '@/components/parent/FamilyDashboard';
import { enrollAdditionalChild } from '@/app/actions/enroll-child';
import { toast } from 'sonner';
import { AvatarRing } from '@/components/ui/avatar-ring';
import { FEATURES } from '@/lib/features';

// ── Code-splitting ──────────────────────────────────────────────────────────────
// Only the Home tab is visible on first paint; the other tabs' components load on
// demand so parents on slow 4G get an interactive portal sooner.
const sectionLoading = () => <div className="w-full h-32 rounded-xl border border-zinc-800/50 bg-zinc-900/30 animate-pulse" aria-busy="true" />;
const RSVPButtons = dynamic(() => import('@/components/parent/RSVPButtons').then((m) => m.RSVPButtons), { loading: () => null });
const ProShop = dynamic(() => import('@/components/parent/ProShop').then((m) => m.ProShop), { loading: sectionLoading });
const MediaFeed = dynamic(() => import('@/components/parent/MediaFeed').then((m) => m.MediaFeed), { loading: sectionLoading });
const GamificationWidget = dynamic(() => import('@/components/parent/GamificationWidget').then((m) => m.GamificationWidget), { loading: sectionLoading });
const ChatWindow = dynamic(() => import('@/components/chat/ChatWindow').then((m) => m.ChatWindow), { loading: sectionLoading });
const AttendanceStats = dynamic(() => import('@/components/parent/AttendanceStats').then((m) => m.AttendanceStats), { loading: sectionLoading });
const FeeHistory = dynamic(() => import('@/components/parent/FeeHistory').then((m) => m.FeeHistory), { loading: sectionLoading });
const ProgressTimeline = dynamic(() => import('@/components/parent/ProgressTimeline').then((m) => m.ProgressTimeline), { loading: sectionLoading });
const ReferralWidget = dynamic(() => import('@/components/parent/ReferralWidget').then((m) => m.ReferralWidget), { loading: sectionLoading });
const FeedbackWidget = dynamic(() => import('@/components/parent/FeedbackWidget').then((m) => m.FeedbackWidget), { loading: sectionLoading });
const AttendanceStreak = dynamic(() => import('@/components/parent/AttendanceStreak').then((m) => m.AttendanceStreak), { loading: sectionLoading });
const MonthlyReport = dynamic(() => import('@/components/parent/MonthlyReport').then((m) => m.MonthlyReport), { loading: sectionLoading });
const AttendanceCalendar = dynamic(() => import('@/components/parent/AttendanceCalendar').then((m) => m.AttendanceCalendar), { loading: sectionLoading });
const CoachDirectory = dynamic(() => import('@/components/parent/CoachDirectory').then((m) => m.CoachDirectory), { loading: sectionLoading });

export function ParentClient({
  session,
  parent,
  children,
  products,
  leaderboard,
  chatMessages,
  announcements,
  totalSessions,
  existingFeedback,
  admin,
  coaches,
  batches,
  currentMonth,
  org,
  logoutAction,
}: any) {
  const [enrollForm, setEnrollForm] = useState({ childName: '', dob: '', batchId: '' });
  const [isEnrolling, startTransition] = useTransition();

  const handleEnrollChild = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await enrollAdditionalChild(enrollForm.childName, enrollForm.dob, enrollForm.batchId);
      if (res.success) {
        toast.success("Child enrolled successfully!");
        setEnrollForm({ childName: '', dob: '', batchId: '' });
      } else {
        toast.error(res.error || "Failed to enroll child");
      }
    });
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: NAV_ICONS.home },
    { id: 'children', label: 'My Children', icon: NAV_ICONS.students },
    { id: 'chat', label: 'Messages', icon: NAV_ICONS.communication },
    { id: 'shop', label: 'Pro Shop', icon: NAV_ICONS.shop },
    { id: 'coaches', label: 'Coaches', icon: NAV_ICONS.people },
    { id: 'more', label: 'More', icon: NAV_ICONS.star },
  ];

  return (
    <DashboardShell
      navItems={navItems}
      defaultTab="home"
      title="Parent Portal"
      subtitle={parent?.name}
      headerActions={
        <button onClick={() => logoutAction()} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-900/50 px-3 py-1.5 rounded-md border border-zinc-800">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      }
    >
      {(activeTab) => (
        <>
          <Suspense fallback={null}>
            <PaymentReturnHandler />
          </Suspense>
          {activeTab === 'home' && (
            <div className="space-y-6">
              <SectionHeader title="Announcements" />
              <div className="grid gap-4">
                {announcements?.map((a: any) => (
                  <Card key={a.id}>
                    <CardContent className="p-4">
                      <p className="font-semibold text-zinc-100">{a.title}</p>
                      <p className="text-sm text-zinc-400">{a.message}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {children?.length > 1 && (
                <FamilyDashboard children={children} />
              )}

              <SectionHeader title="Children Overview" />
              {children?.map((child: any) => {
                // Real per-child attendance: present / sessions held for the child's batches
                const attendancePct = child.attendanceSummary?.pct ?? 0;
                const feeStatus = child.feeRecords?.[0]?.status === 'PAID' ? 'Paid' : 'Unpaid';
                
                const attendancePercent = child.attendanceSummary?.pct == null ? '—' : Number(attendancePct).toFixed(0);
                const dob = child.dob || child.dateOfBirth;
                const age = dob ? Math.max(1, new Date().getFullYear() - new Date(dob).getFullYear()) : 'N/A';
                const batchName = child.enrollments?.[0]?.batch?.name || 'Unassigned';
                const level = child.skillReports?.[0]?.level || Math.floor(child.points / 100) + 1;
                const points = child.points;
                // Oldest unpaid fee first so parents clear dues in order
                const dueFees = [...(child.dueFees || [])].sort((a: any, b: any) => a.month.localeCompare(b.month));
                const pendingRecord = dueFees[0] || null;
                const pendingFee = dueFees.filter((f: any) => f.status === 'PENDING').reduce((s: number, f: any) => s + (f.amount || 0), 0);
                const awaitingConfirmation = dueFees.some((f: any) => f.status === 'PENDING_VERIFICATION');
                
                let streak = 0;
                if (child.attendances && child.attendances.length > 0) {
                  for (let i = 0; i < child.attendances.length; i++) {
                    if (child.attendances[i].isPresent) streak++;
                    else break;
                  }
                }

                // Compute week status
                const today = new Date();
                const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday...
                // Adjust to make Monday 0
                const dayOffset = currentDay === 0 ? 6 : currentDay - 1;
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - dayOffset);
                startOfWeek.setHours(0,0,0,0);
                
                const weekStatus = ['M','T','W','T','F','S','S'].map((day, i) => {
                  const dateForDay = new Date(startOfWeek);
                  dateForDay.setDate(startOfWeek.getDate() + i);
                  
                  if (dateForDay > today) return { day, status: 'future' };
                  
                  const dateStr = dateForDay.toISOString().split('T')[0];
                  const record = child.attendances?.find((a: any) => a.session?.date?.startsWith(dateStr));
                  if (!record) return { day, status: 'none' };
                  return { day, status: record.isPresent ? 'present' : 'absent' };
                });
                
                return (
                  <div key={child.id} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/50 mb-6">
                    {/* Accent gradient at top */}
                    <div className="h-1 bg-gradient-to-r from-emerald-500 to-cyan-500" />
                    
                    {/* Child info with avatar ring */}
                    <div className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <AvatarRing name={child.name} percentage={Number(attendancePct) || 0} size="lg" showLabel={false} />
                        <div>
                          <h2 className="text-lg font-semibold text-zinc-100">{child.name}</h2>
                          <p className="text-sm text-zinc-400">Age {age} · {batchName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Level {level}</span>
                            <span className="text-xs text-zinc-500">{points} pts</span>
                          </div>
                        </div>
                      </div>
                      {pendingRecord && (
                        <div className="hidden sm:block">
                          <CheckoutModal feeRecordId={pendingRecord.id} amount={pendingRecord.amount} month={pendingRecord.month} status={pendingRecord.status} studentName={child.name} academyName={org?.name} upiId={org?.upiId} />
                        </div>
                      )}
                    </div>

                    {/* Quick stats row */}
                    <div className="grid grid-cols-3 border-t border-zinc-800/50">
                      <div className="p-3 text-center border-r border-zinc-800/50">
                        <div className="text-lg font-semibold text-zinc-100">{attendancePercent}{attendancePercent === '—' ? '' : '%'}</div>
                        <div className="text-[10px] text-zinc-500 uppercase">Attendance</div>
                      </div>
                      <div className="p-3 text-center border-r border-zinc-800/50">
                        <div className="text-lg font-semibold text-zinc-100">
                          {pendingFee > 0 ? (
                            <span className="text-amber-400">₹{pendingFee}</span>
                          ) : awaitingConfirmation ? (
                            <span className="text-sky-400 text-sm">Awaiting confirmation</span>
                          ) : (
                            <span className="text-emerald-400">Paid ✓</span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500 uppercase">Fees Due</div>
                      </div>
                      <div className="p-3 text-center">
                        <div className="text-lg font-semibold text-zinc-100">{streak}</div>
                        <div className="text-[10px] text-zinc-500 uppercase">Streak 🔥</div>
                      </div>
                    </div>

                    {/* Mobile Fee Payment Banner */}
                    {pendingRecord && (
                      <div className="p-3 bg-amber-500/10 border-t border-amber-500/20 sm:hidden flex items-center justify-between gap-3">
                        <div className="text-xs text-amber-300">
                          <span className="font-semibold">₹{pendingRecord.amount}</span> {pendingRecord.status === 'PENDING_VERIFICATION' ? 'awaiting confirmation' : 'due'} for {pendingRecord.month}
                        </div>
                        <div className="shrink-0">
                          <CheckoutModal feeRecordId={pendingRecord.id} amount={pendingRecord.amount} month={pendingRecord.month} status={pendingRecord.status} studentName={child.name} academyName={org?.name} upiId={org?.upiId} />
                        </div>
                      </div>
                    )}

                    {/* This Week */}
                    <div className="p-4 border-t border-zinc-800/50">
                      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">This Week</h3>
                      <div className="flex gap-2">
                        {weekStatus.map((ws, i) => (
                          <div key={i} className={`flex-1 aspect-square rounded-lg flex flex-col items-center justify-center text-xs
                            ${ws.status === 'present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              ws.status === 'absent' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                              'bg-zinc-800/50 text-zinc-600 border border-zinc-800'}`}>
                            <span className="font-medium">{ws.day}</span>
                            <span>{ws.status === 'present' ? '✓' : ws.status === 'absent' ? '✕' : '·'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'children' && (
            <div className="space-y-6">
              <SectionHeader title="My Children Details" />
              {children?.map((child: any) => (
                <Card key={child.id} className="mb-6">
                  <CardHeader>
                    <CardTitle>{child.name}</CardTitle>
                    {(FEATURES.progressReport || FEATURES.athleteOS) && (
                      <div className="flex flex-wrap gap-2 pt-2 text-sm">
                        {FEATURES.progressReport && (
                          <a href={`/student/${child.id}/report`} className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-100 hover:bg-zinc-800">Monthly report</a>
                        )}
                        {FEATURES.athleteOS && (
                          <a href={`/student/${child.id}#athlete`} className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-100 hover:bg-zinc-800">Achievements &amp; goals</a>
                        )}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <AttendanceStats attendances={child.attendances} totalSessions={child.attendanceSummary?.totalSessions ?? 0} presentCount={child.attendanceSummary?.presentCount} />
                      <AttendanceStreak attendances={child.attendances} />
                    </div>
                    
                    <div className="flex justify-center">
                      <AttendanceCalendar attendances={child.attendances || []} />
                    </div>
                    
                    <FeeHistory studentId={child.id} />
                    
                    <ProgressTimeline reports={child.skillReports as any} />
                    
                    <MonthlyReport
                      child={child}
                      attendances={child.attendances}
                      report={child.skillReports?.[0]}
                      month={currentMonth}
                      feeStatus={child.feeRecords?.[0]?.status}
                    />
                    
                    <GamificationWidget student={child} leaderboard={leaderboard} />
                    
                    <MediaFeed media={child.Media || []} />
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold text-zinc-100">Events</h4>
                      {child.RSVP?.map((rsvp: any) => (
                        <div key={rsvp.id} className="flex justify-between items-center p-4 border border-zinc-800 rounded-lg bg-zinc-900/40">
                          <span className="text-zinc-100">{rsvp.event?.title}</span>
                          <RSVPButtons eventId={rsvp.eventId} studentId={child.id} currentStatus={rsvp.status} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Card className="border-zinc-800 bg-zinc-900/50 mt-8">
                <CardHeader>
                  <CardTitle>Enroll Another Child</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleEnrollChild} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm text-zinc-400">Child Name</label>
                        <input
                          type="text"
                          required
                          value={enrollForm.childName}
                          onChange={(e) => setEnrollForm({ ...enrollForm, childName: e.target.value })}
                          className="w-full flex h-10 items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-zinc-400">Date of Birth</label>
                        <input
                          type="date"
                          required
                          value={enrollForm.dob}
                          onChange={(e) => setEnrollForm({ ...enrollForm, dob: e.target.value })}
                          className="w-full flex h-10 items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-700"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-400">Select Batch</label>
                      <select
                        required
                        value={enrollForm.batchId}
                        onChange={(e) => setEnrollForm({ ...enrollForm, batchId: e.target.value })}
                        className="w-full flex h-10 items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-700"
                      >
                        <option value="">Select a batch</option>
                        {batches?.map((b: any) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.sport})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={isEnrolling}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm disabled:opacity-50"
                    >
                      {isEnrolling ? 'Enrolling...' : 'Enroll Child'}
                    </button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="space-y-6">
              <SectionHeader title="Messages" />
              {admin ? (
                <ChatWindow
                  currentUserId={parent.id}
                  otherUserId={admin.id}
                  otherUserName={admin.name}
                  messages={chatMessages}
                />
              ) : (
                <p className="text-zinc-400">No admin available to chat.</p>
              )}
            </div>
          )}

          {activeTab === 'shop' && (
            <div className="space-y-6">
              <SectionHeader title="Pro Shop" />
              <ProShop products={products} studentId={children?.[0]?.id} />
            </div>
          )}

          {activeTab === 'coaches' && (
            <div className="space-y-6">
              <CoachDirectory coaches={coaches} />
            </div>
          )}

          {activeTab === 'more' && (
            <div className="space-y-6">
              <SectionHeader title="More Actions" />
              <ReferralWidget userId={parent.id} />
              <FeedbackWidget parentId={parent.id} existingFeedback={existingFeedback} />
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
