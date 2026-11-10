'use client';
import { Suspense, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { PaymentReturnHandler } from '@/components/parent/PaymentReturnHandler';
import { DashboardShell, SectionHeader, NAV_ICONS, type NavGroup, type NavItem } from '@/components/ui/dashboard-shell';
import { MoreScreen } from '@/components/shell/MoreScreen';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut } from 'lucide-react';
import { FamilyDashboard } from '@/components/parent/FamilyDashboard';
import { enrollAdditionalChild } from '@/app/actions/enroll-child';
import { toast } from 'sonner';
import { ChildTopCard, type ChildTopCardData } from '@/components/parent/ChildTopCard';
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
const AutopayCard = dynamic(() => import('@/components/parent/AutopayCard').then((m) => m.AutopayCard), { loading: sectionLoading });
const ProgressTimeline = dynamic(() => import('@/components/parent/ProgressTimeline').then((m) => m.ProgressTimeline), { loading: sectionLoading });
const ReferralWidget = dynamic(() => import('@/components/parent/ReferralWidget').then((m) => m.ReferralWidget), { loading: sectionLoading });
const FeedbackWidget = dynamic(() => import('@/components/parent/FeedbackWidget').then((m) => m.FeedbackWidget), { loading: sectionLoading });
const AttendanceStreak = dynamic(() => import('@/components/parent/AttendanceStreak').then((m) => m.AttendanceStreak), { loading: sectionLoading });
const MonthlyReport = dynamic(() => import('@/components/parent/MonthlyReport').then((m) => m.MonthlyReport), { loading: sectionLoading });
const AttendanceCalendar = dynamic(() => import('@/components/parent/AttendanceCalendar').then((m) => m.AttendanceCalendar), { loading: sectionLoading });
const OpportunitiesCard = dynamic(() => import('@/components/parent/OpportunitiesCard').then((m) => m.OpportunitiesCard), { loading: sectionLoading });
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
  homeCards,
  today,
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

  // Same pattern as the coach and owner apps: five tabs at the bottom, everything else under More.
  const navItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: NAV_ICONS.home },
    { id: 'children', label: 'Progress', icon: NAV_ICONS.students },
    { id: 'fees', label: 'Fees', icon: NAV_ICONS.wallet },
    { id: 'chat', label: 'Messages', icon: NAV_ICONS.communication },
    { id: 'more', label: 'More', icon: NAV_ICONS.more },
  ];
  const moreGroups: NavGroup[] = [
    {
      label: 'Your child',
      items: [
        ...(FEATURES.rewards ? [{ id: 'l-rewards', label: 'Rewards & badges', icon: NAV_ICONS.trophy, href: '/rewards' }] : []),
        ...(FEATURES.media ? [{ id: 'l-photos', label: 'Photos', icon: NAV_ICONS.heart, href: '/gallery' }] : []),
        { id: 'l-mind', label: 'Mind & Performance', icon: NAV_ICONS.star, href: '/mind' },
        ...(FEATURES.opportunities ? [{ id: 'opportunities', label: 'Trials & scholarships', icon: NAV_ICONS.ticket }] : []),
        { id: 'coaches', label: 'Coaches', icon: NAV_ICONS.people },
      ],
    },
    {
      label: 'Help for parents',
      items: [
        { id: 'l-support', label: 'Supporting your athlete', icon: NAV_ICONS.heart, href: '/mind/parents' },
        { id: 'l-pros', label: 'Find a professional', icon: NAV_ICONS.people, href: '/pros' },
        { id: 'l-help', label: 'Need help now?', icon: NAV_ICONS.bell, href: '/mind/support' },
      ],
    },
    {
      label: 'Family',
      items: [
        { id: 'enrol', label: 'Enrol another child', icon: NAV_ICONS.students },
        { id: 'l-family', label: 'Family & waivers', icon: NAV_ICONS.people, href: '/family' },
        { id: 'l-consent', label: 'Privacy & consent', icon: NAV_ICONS.settings, href: '/consent' },
        { id: 'l-notify', label: 'Notification settings', icon: NAV_ICONS.bell, href: '/settings/notifications' },
      ],
    },
    {
      label: 'Academy',
      items: [
        ...(FEATURES.marketplace ? [{ id: 'shop', label: 'Kit store', icon: NAV_ICONS.shop }] : []),
        { id: 'feedback', label: 'Feedback & referrals', icon: NAV_ICONS.send },
      ],
    },
  ];

  return (
    <DashboardShell
      navItems={navItems}
      moreGroups={moreGroups}
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
      {(activeTab, setActiveTab) => (
        <>
          <Suspense fallback={null}>
            <PaymentReturnHandler />
          </Suspense>
          {activeTab === 'home' && (
            <div className="space-y-6">
              {/* Top card per child: next session, this week, fees, latest coach note (phone-first) */}
              <div className="grid gap-4 md:grid-cols-2">
                {(homeCards || []).map((card: ChildTopCardData) => (
                  <ChildTopCard key={card.id} data={card} today={today} academyName={org?.name} upiId={org?.upiId} />
                ))}
                {(!homeCards || homeCards.length === 0) && (
                  <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-muted">
                    No children linked to your account yet. Ask the academy to add your child, or enrol one under My Children.
                  </p>
                )}
              </div>


              {children?.length > 1 && (
                <FamilyDashboard children={children} />
              )}

              {announcements?.length > 0 && (
                <>
                  <SectionHeader title="Announcements" />
                  <div className="grid gap-4">
                    {announcements.map((a: any) => (
                      <Card key={a.id}>
                        <CardContent className="p-4">
                          <p className="font-semibold text-ink">{a.title}</p>
                          <p className="text-sm text-ink-muted">{a.message}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'children' && (
            <div className="space-y-6">
              <SectionHeader title="Progress" />
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

            </div>
          )}

          {activeTab === 'fees' && (
            <div className="space-y-6">
              <SectionHeader title="Fees" />
              <a href="/parent/statement" className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2">
                Download fee statement
              </a>
              {children?.map((child: any) => (
                <Card key={child.id}>
                  <CardHeader>
                    <CardTitle>{child.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FeeHistory studentId={child.id} />
                    {FEATURES.upiAutopay && <AutopayCard studentId={child.id} />}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'enrol' && (
            <div className="space-y-6">
              <Card className="border-zinc-800 bg-zinc-900/50">
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

          {activeTab === 'shop' && FEATURES.marketplace && (
            <div className="space-y-6">
              <SectionHeader title="Pro Shop" />
              <ProShop
                products={products}
                studentId={children?.[0]?.id}
                kids={(children || []).map((c: any) => ({ id: c.id, name: c.name }))}
              />
            </div>
          )}

          {activeTab === 'coaches' && (
            <div className="space-y-6">
              <CoachDirectory coaches={coaches} />
            </div>
          )}

          {activeTab === 'more' && <MoreScreen groups={moreGroups} onNavigate={setActiveTab} />}

          {activeTab === 'opportunities' && FEATURES.opportunities && (
            <div className="space-y-6">
              <SectionHeader title="Trials & scholarships" />
              <OpportunitiesCard academyName={org?.name} />
            </div>
          )}

          {activeTab === 'feedback' && (
            <div className="space-y-6">
              <SectionHeader title="Feedback & referrals" />
              {FEATURES.growthTools && <ReferralWidget userId={parent.id} />}
              <FeedbackWidget parentId={parent.id} existingFeedback={existingFeedback} />
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
