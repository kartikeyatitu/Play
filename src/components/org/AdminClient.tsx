"use client";
import React from "react";
import { DashboardShell, SectionHeader, NAV_ICONS, type NavGroup, type NavItem } from "@/components/ui/dashboard-shell";
import { TodayScreen, type TodayInsights } from "@/components/shell/TodayScreen";
import { BookingsScreen } from "@/components/shell/BookingsScreen";
import { MoreScreen } from "@/components/shell/MoreScreen";
import { FEATURES } from "@/lib/features";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import dynamic from "next/dynamic";
import { CommandPalette } from "@/components/ui/command-palette";
import { FeeToggle } from "@/components/org/FeeToggle";
import { SeedButton } from "@/components/org/SeedButton";
import { OnboardingWizard } from "@/components/org/OnboardingWizard";
import { ProductTour } from "@/components/org/ProductTour";
import { LoginLinkButton } from "@/components/org/LoginLinkButton";
import { Deferred, SectionSkeleton } from "@/components/org/Deferred";
import { StudentDetailDrawer } from "@/components/org/StudentDetailDrawer";

// ── Code-splitting ──────────────────────────────────────────────────────────────
// Only the Overview tab is visible on first paint. Everything below is rendered
// only when its tab is opened, so it's split into separate chunks that load on
// demand (and the most-used tabs are prefetched when the browser is idle — see
// the effect in AdminClient). This keeps recharts, xlsx-import UI, WhatsApp tools,
// etc. out of the initial bundle on mid-range Android phones.
const sectionLoading = () => <SectionSkeleton />;
const inlineLoading = () => null;

const CreateBatchDialog = dynamic(() => import("@/components/admin/CreateBatchDialog").then((m) => m.CreateBatchDialog), { loading: inlineLoading });
const CreateCoachDialog = dynamic(() => import("@/components/org/CreateCoachDialog").then((m) => m.CreateCoachDialog), { loading: inlineLoading });
const CreateStudentDialog = dynamic(() => import("@/components/org/CreateStudentDialog").then((m) => m.CreateStudentDialog), { loading: inlineLoading });
const BroadcastTab = dynamic(() => import("@/components/org/BroadcastTab").then((m) => m.BroadcastTab), { loading: sectionLoading });
const StoreManager = dynamic(() => import("@/components/org/StoreManager").then((m) => m.StoreManager), { loading: sectionLoading });
const InboxTab = dynamic(() => import("@/components/org/InboxTab").then((m) => m.InboxTab), { loading: sectionLoading });
const FacilitiesTab = dynamic(() => import("@/components/org/FacilitiesTab").then((m) => m.FacilitiesTab), { loading: sectionLoading });
// recharts-based: client only (ResponsiveContainer measures the DOM anyway)
const AnalyticsDashboard = dynamic(() => import("@/components/org/AnalyticsDashboard").then((m) => m.AnalyticsDashboard), { ssr: false, loading: sectionLoading });
const RevenueForecast = dynamic(() => import("@/components/org/RevenueForecast").then((m) => m.RevenueForecast), { ssr: false, loading: sectionLoading });
const StudentGrowthTracker = dynamic(() => import("@/components/org/StudentGrowthTracker").then((m) => m.StudentGrowthTracker), { ssr: false, loading: sectionLoading });
const GenerateFeesButton = dynamic(() => import("@/components/org/GenerateFeesButton").then((m) => m.GenerateFeesButton), { loading: inlineLoading });
const ExportCSV = dynamic(() => import("@/components/org/ExportCSV").then((m) => m.ExportCSV), { loading: inlineLoading });
const HolidayManager = dynamic(() => import("@/components/org/HolidayManager").then((m) => m.HolidayManager), { loading: sectionLoading });
const WaitlistManager = dynamic(() => import("@/components/org/WaitlistManager").then((m) => m.WaitlistManager), { loading: sectionLoading });
const BatchTransfer = dynamic(() => import("@/components/org/BatchTransfer").then((m) => m.BatchTransfer), { loading: sectionLoading });
const CouponManager = dynamic(() => import("@/components/org/CouponManager").then((m) => m.CouponManager), { loading: sectionLoading });
const GenerateSessionsButton = dynamic(() => import("@/components/org/GenerateSessionsButton").then((m) => m.GenerateSessionsButton), { loading: inlineLoading });
const RevenueProjection = dynamic(() => import("@/components/org/RevenueProjection").then((m) => m.RevenueProjection), { loading: sectionLoading });
const CapacityAlerts = dynamic(() => import("@/components/org/CapacityAlerts").then((m) => m.CapacityAlerts), { loading: sectionLoading });
const CoachPerformance = dynamic(() => import("@/components/org/CoachPerformance").then((m) => m.CoachPerformance), { loading: sectionLoading });
const ChurnPredictor = dynamic(() => import("@/components/org/ChurnPredictor").then((m) => m.ChurnPredictor), { loading: sectionLoading });
const FeePricingAnalyzer = dynamic(() => import("@/components/org/FeePricingAnalyzer").then((m) => m.FeePricingAnalyzer), { loading: sectionLoading });
const SocialPostGenerator = dynamic(() => import("@/components/org/SocialPostGenerator").then((m) => m.SocialPostGenerator), { loading: sectionLoading });
const CoachVerification = dynamic(() => import("@/components/org/CoachVerification").then((m) => m.CoachVerification), { loading: sectionLoading });
const PhotoGallery = dynamic(() => import("@/components/org/PhotoGallery").then((m) => m.PhotoGallery), { loading: sectionLoading });
const LeadPipeline = dynamic(() => import("@/components/org/LeadPipeline").then((m) => m.LeadPipeline), { loading: sectionLoading });
const AddLeadForm = dynamic(() => import("@/components/org/AddLeadForm").then((m) => m.AddLeadForm), { loading: inlineLoading });
const TransportManager = dynamic(() => import("@/components/org/TransportManager").then((m) => m.TransportManager), { loading: sectionLoading });
const TournamentBracket = dynamic(() => import("@/components/org/TournamentBracket").then((m) => m.TournamentBracket), { loading: sectionLoading });
const CertificateGenerator = dynamic(() => import("@/components/org/CertificateGenerator").then((m) => m.CertificateGenerator), { loading: sectionLoading });
const AttendanceInsights = dynamic(() => import("@/components/org/AttendanceInsights").then((m) => m.AttendanceInsights), { loading: sectionLoading });
const BatchHealthReport = dynamic(() => import("@/components/org/BatchHealthReport").then((m) => m.BatchHealthReport), { loading: sectionLoading });
const ParentEngagement = dynamic(() => import("@/components/org/ParentEngagement").then((m) => m.ParentEngagement), { loading: sectionLoading });
const WhatsAppReminder = dynamic(() => import("@/components/org/WhatsAppReminder").then((m) => m.WhatsAppReminder), { loading: inlineLoading });
const AutoReminders = dynamic(() => import("@/components/org/AutoReminders").then((m) => m.AutoReminders), { loading: sectionLoading });
const BirthdayTracker = dynamic(() => import("@/components/org/BirthdayTracker").then((m) => m.BirthdayTracker), { loading: sectionLoading });
const CalendarExport = dynamic(() => import("@/components/org/CalendarExport").then((m) => m.CalendarExport), { loading: sectionLoading });
const ImportExcelButton = dynamic(() => import("@/components/org/ImportExcelButton").then((m) => m.ImportExcelButton), { loading: inlineLoading });
const ExcelImport = dynamic(() => import("@/components/org/ExcelImport").then((m) => m.ExcelImport), { loading: sectionLoading });
const WhatsAppRosterImport = dynamic(() => import("@/components/org/WhatsAppRosterImport").then((m) => m.WhatsAppRosterImport), { loading: inlineLoading });
const PaymentPlans = dynamic(() => import("@/components/org/PaymentPlans").then((m) => m.PaymentPlans), { loading: sectionLoading });
const ReferralProgram = dynamic(() => import("@/components/org/ReferralProgram").then((m) => m.ReferralProgram), { loading: sectionLoading });
const TestimonialCollector = dynamic(() => import("@/components/org/TestimonialCollector").then((m) => m.TestimonialCollector), { loading: sectionLoading });
const ContentCalendar = dynamic(() => import("@/components/org/ContentCalendar").then((m) => m.ContentCalendar), { loading: sectionLoading });
const InstagramGenerator = dynamic(() => import("@/components/org/InstagramGenerator").then((m) => m.InstagramGenerator), { loading: sectionLoading });
const PayNowButton = dynamic(() => import("@/components/org/PayNowButton").then((m) => m.PayNowButton), { loading: inlineLoading });
const WhatsAppTemplates = dynamic(() => import("@/components/org/WhatsAppTemplates").then((m) => m.WhatsAppTemplates), { loading: sectionLoading });
const BulkWhatsApp = dynamic(() => import("@/components/org/BulkWhatsApp").then((m) => m.BulkWhatsApp), { loading: sectionLoading });
const AcademySettings = dynamic(() => import("@/components/org/AcademySettings").then((m) => m.AcademySettings), { loading: sectionLoading });
const TrialManager = dynamic(() => import("@/components/org/TrialManager").then((m) => m.TrialManager), { loading: sectionLoading });
const PendingPayments = dynamic(() => import("@/components/org/PendingPayments").then((m) => m.PendingPayments), { loading: sectionLoading });
const BatchFeeEditor = dynamic(() => import("@/components/org/BatchFeeEditor").then((m) => m.BatchFeeEditor), { loading: inlineLoading });

/** Warm the chunks of the most-used tabs once the browser is idle (no effect on first paint). */
function prefetchCommonTabs() {
  void import("@/components/org/CreateStudentDialog");
  void import("@/components/org/WhatsAppRosterImport");
  void import("@/components/org/TrialManager");
  void import("@/components/org/CoachVerification");
  void import("@/components/org/BirthdayTracker");
  void import("@/components/org/PendingPayments");
  void import("@/components/org/PayNowButton");
  void import("@/components/org/WhatsAppReminder");
  void import("@/components/org/GenerateFeesButton");
  void import("@/components/org/BatchFeeEditor");
}

/**
 * Data for tabs that aren't visible on first paint. The page streams this as a promise
 * (not awaited on the server) so the Overview renders without waiting for it.
 */
export interface AdminSecondaryData {
  products: any[];
  orders: any[];
  parents: any[];
  messages: any[];
  facilities: any[];
  equipment: any[];
  waitlist: any[];
  coupons: any[];
  galleryPhotos: any[];
  transportRoutes: any[];
  feePlans: any[];
  testimonials: any[];
  referrals: any[];
  leadStats: any;
  analytics: any;
}


interface AdminClientProps {
  session: any;
  org?: any;
  students: any[];
  batches: any[];
  coaches: any[];
  allFeeRecords: any[];
  trials: any[];
  leads?: any[];
  /** Streamed (not awaited on the server) — data for tabs not visible on first paint */
  secondary: Promise<AdminSecondaryData>;
  currentMonth: string;
  stats: {
    totalStudents: number;
    revenueThisMonth: number;
    pendingDues: number;
    paidFeesCount: number;
    feesCollectedRatio: string;
    revenueTrendPct?: number | null;
    revenueSparkline?: number[];
    newStudentsThisWeek?: number;
    typicalFee?: number | null;
    billedThisMonth?: number;
  };
  /** Resolved monthly fee per student (0 = not set) */
  studentFees?: Record<string, number>;
  /** Fee records parents marked "I've paid" — awaiting admin confirmation */
  pendingVerification?: any[];
  /** Academy-wide numbers for the Today screen (computed on the server) */
  insights?: TodayInsights | null;
  logoutAction: () => void;
  currentPage?: number;
  totalStudents?: number;
}

// ── Navigation ───────────────────────────────────────────────────────────────────
// 5 primary sections (mobile bottom bar). Everything else lives under "More", grouped.
// Tab ids are kept stable (overview = Today, communication = Messages) so deep links,
// the command palette and the product tour keep working.
const primaryNav: NavItem[] = [
  { id: "overview", label: "Today", icon: NAV_ICONS.today },
  { id: "people", label: "People", icon: NAV_ICONS.people },
  { id: "fees", label: "Fees", icon: NAV_ICONS.wallet },
  ...(FEATURES.bookings ? [{ id: "bookings", label: "Bookings", icon: NAV_ICONS.bookings }] : []),
  { id: "more", label: "More", icon: NAV_ICONS.more },
];

const moreGroups: NavGroup[] = [
  {
    label: "Run",
    items: [
      { id: "batches", label: "Batches", icon: NAV_ICONS.batches },
      { id: "leads", label: "Leads", icon: NAV_ICONS.people },
      { id: "communication", label: "Messages", icon: NAV_ICONS.communication },
      { id: "analytics", label: "Analytics", icon: NAV_ICONS.analytics },
      ...(FEATURES.experimental ? [{ id: "ai", label: "AI Insights", icon: NAV_ICONS.trophy }] : []),
    ],
  },
  {
    label: "Grow",
    items: [
      ...(FEATURES.experimental ? [{ id: "marketing", label: "Marketing", icon: NAV_ICONS.send }] : []),
      { id: "gallery", label: "Gallery", icon: NAV_ICONS.heart },
      { id: "store", label: "Kit Store", icon: NAV_ICONS.shop },
      ...(FEATURES.events ? [{ id: "events", label: "Events", icon: NAV_ICONS.ticket }] : []),
    ],
  },
  {
    label: "Admin",
    items: [
      { id: "operations", label: "Operations", icon: NAV_ICONS.building },
      { id: "settings", label: "Settings", icon: NAV_ICONS.settings },
    ],
  },
];

/** Tabs whose feature flag is off: programmatic navigation (palette, tour) falls back to Today. */
const HIDDEN_TABS = new Set<string>([
  ...(FEATURES.experimental ? [] : ["ai", "marketing"]),
  ...(FEATURES.events ? [] : ["events"]),
  ...(FEATURES.bookings ? [] : ["bookings"]),
]);

/** Demo-data loader is a development tool: Settings only, never in production. */
const SHOW_SEED = process.env.NODE_ENV !== "production";

export function AdminClient({ session, org, students, batches, coaches, allFeeRecords, trials, leads = [], secondary, currentMonth, stats, logoutAction, currentPage = 1, totalStudents = 0, studentFees = {}, pendingVerification = [], insights = null }: AdminClientProps) {
  const academyName = org?.name || session.orgName || "Your Academy";
  const orgSlug = org?.slug || session.orgSlug || "";
  const upiId = org?.upiId || null;
  const coachRate: number | null = org?.coachSessionRate ?? null;
  const [tourFirstVisit, setTourFirstVisit] = React.useState(false);
  React.useEffect(() => {
    // Show the product tour automatically only if this browser has never seen it
    try { setTourFirstVisit(!localStorage.getItem("sportsos_tour_v2")); } catch { setTourFirstVisit(false); }
  }, []);
  React.useEffect(() => {
    // After first paint, warm the code chunks of the most-used tabs when the main thread is idle
    const w = window as any;
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(prefetchCommonTabs, { timeout: 5000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(prefetchCommonTabs, 3000);
    return () => window.clearTimeout(t);
  }, []);
  const [selectedStudent, setSelectedStudent] = React.useState<any>(null);
  const setActiveTabRef = React.useRef<(tab: string) => void>(() => {});
  const exportStudents = students.map((s: any) => ({
    name: s.name,
    parentName: s.parent?.name || "",
    parentPhone: s.parent?.phone || "",
    batchNames: s.enrollments?.map((e: any) => e.batch?.name).join(", ") || "",
    feeStatus: s.feeRecords?.[0]?.status || "PENDING",
  }));

  return (
    <DashboardShell
      title={academyName}
      subtitle={`${stats.totalStudents} student${stats.totalStudents === 1 ? "" : "s"}`}
      navItems={primaryNav}
      moreGroups={moreGroups}
      brandColor={org?.brandColor}
      defaultTab="overview"
      headerActions={
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-3">
            <a href="/pricing" className="text-xs text-zinc-500 hover:text-zinc-200 transition">Pricing ↗</a>
            <a href={orgSlug ? `/join?academy=${encodeURIComponent(orgSlug)}` : "/join"} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:text-zinc-200 transition">Registration ↗</a>
            <a href={orgSlug ? `/trial?academy=${encodeURIComponent(orgSlug)}` : "/trial"} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:text-zinc-200 transition">Trial ↗</a>
            <ProductTour onNavigate={(tab) => setActiveTabRef.current(tab)} isFirstVisit={tourFirstVisit && batches.length > 0 && students.length > 0} />
          </div>
          <form action={logoutAction}>
            <button className="min-h-[44px] text-xs sm:text-sm text-zinc-400 hover:text-white border border-zinc-800 px-3 rounded-xl transition whitespace-nowrap">
              Sign Out
            </button>
          </form>
        </div>
      }
    >
      {(activeTab, setActiveTab) => {
        // Flag-hidden tabs fall back to Today (palette / tour may still point at them)
        const go = (tab: string) => setActiveTab(HIDDEN_TABS.has(tab) ? "overview" : tab);
        setActiveTabRef.current = go;
        return (
        <>
          <CommandPalette
            students={students.map((s: any) => ({ id: s.id, name: s.name, parent: s.parent }))}
            coaches={coaches.map((c: any) => ({ id: c.id, name: c.name }))}
            batches={batches.map((b: any) => ({ id: b.id, name: b.name, sport: b.sport }))}
            onNavigate={go}
          />
          {/* TODAY */}
          {activeTab === "overview" && (
            <TodayScreen
              ownerName={session?.name}
              batches={batches}
              allFeeRecords={allFeeRecords}
              pendingVerification={pendingVerification}
              leads={leads}
              trials={trials}
              insights={insights}
              currentMonth={currentMonth}
              pendingDues={stats.pendingDues}
              onNavigate={go}
              top={<OnboardingWizard session={session} hasBatches={batches.length > 0} hasCoaches={coaches.length > 0} hasStudents={students.length > 0} coaches={coaches} batches={batches} />}
            />
          )}

          {/* BOOKINGS */}
          {activeTab === "bookings" && FEATURES.bookings && <BookingsScreen />}

          {/* MORE (mobile hub — desktop shows the same groups in the sidebar) */}
          {activeTab === "more" && <MoreScreen groups={moreGroups} onNavigate={go} />}

          {/* PEOPLE */}
          {activeTab === "people" && (
            <div className="space-y-8">
              <div>
                <SectionHeader
                  title="Students"
                  description={`${totalStudents} enrolled`}
                  actions={
                    <div className="flex items-center gap-2 flex-wrap">
                      <ImportExcelButton />
                      <WhatsAppRosterImport existingBatches={batches} />
                      <CreateStudentDialog batches={batches.map((b: any) => ({ id: b.id, name: b.name, sport: b.sport }))} orgId={session.orgId} />
                    </div>
                  }
                />
                <div className="rounded-xl border border-zinc-800/50 overflow-hidden">
                  <div className="overflow-x-auto w-full custom-scrollbar">
                    <Table className="min-w-[620px]">
                      <TableHeader><TableRow className="border-zinc-800/50 bg-zinc-900/40 hover:bg-zinc-900/40">
                        <TableHead className="text-zinc-500 text-xs uppercase">Name</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase">Parent</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase">Batch</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase">Status</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase text-right">Fee</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {students.map((s: any) => {
                          const atRisk = s.attendances?.length >= 3 && s.attendances.slice(0, 3).every((a: any) => !a.isPresent);
                          return (
                            <TableRow key={s.id} className="border-zinc-800/30 hover:bg-zinc-800/20">
                              <TableCell>
                                <button
                                  onClick={() => setSelectedStudent(s)}
                                  className="brand-text hover:underline font-medium text-left"
                                >
                                  {s.name}
                                </button>
                              </TableCell>
                              <TableCell className="text-zinc-400 text-sm">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>{s.parent?.name} · {s.parent?.phone}</span>
                                  {s.parent?.id && <LoginLinkButton userId={s.parent.id} name={s.parent.name} phone={s.parent.phone} academyName={academyName} />}
                                </div>
                              </TableCell>
                              <TableCell className="text-zinc-400 text-sm">{s.enrollments?.map((e: any) => e.batch?.name).join(", ") || "—"}</TableCell>
                              <TableCell>{atRisk && <Badge variant="rose">At Risk</Badge>}</TableCell>
                              <TableCell className="text-right"><FeeToggle studentId={s.id} month={currentMonth} initialStatus={s.feeRecords?.[0]?.status || "PENDING"} /></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/40 border-t border-zinc-800/50">
                    <span className="text-sm text-zinc-400">Showing {students.length} of {totalStudents}</span>
                    <div className="flex gap-2">
                      {currentPage > 1 && (
                        <a href={`?page=${currentPage - 1}&tab=people`} className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-white rounded transition">Previous</a>
                      )}
                      {currentPage * 20 < totalStudents && (
                        <a href={`?page=${currentPage + 1}&tab=people`} className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-white rounded transition">Next</a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {selectedStudent && (
                <StudentDetailDrawer
                  open={!!selectedStudent}
                  onOpenChange={(v) => !v && setSelectedStudent(null)}
                  student={selectedStudent}
                  batches={batches}
                  currentMonth={currentMonth}
                />
              )}
              <div>
                <SectionHeader title="Coaches" description={`${coaches.length} active`} actions={<CreateCoachDialog orgId={session.orgId} />} />
                <div className="rounded-xl border border-zinc-800/50 overflow-hidden">
                  <div className="overflow-x-auto w-full custom-scrollbar">
                    <Table className="min-w-[500px]">
                      <TableHeader><TableRow className="border-zinc-800/50 bg-zinc-900/40 hover:bg-zinc-900/40">
                        <TableHead className="text-zinc-500 text-xs uppercase">Name</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase">Phone</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase text-right">Sessions</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase text-right">Payout</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase text-right">Access</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {coaches.map((c: any) => {
                          const sessions = c.batches?.reduce((sum: number, b: any) => sum + (b.sessions?.length || 0), 0) || 0;
                          return (
                            <TableRow key={c.id} className="border-zinc-800/30 hover:bg-zinc-800/20">
                              <TableCell className="font-medium text-zinc-200">{c.name}</TableCell>
                              <TableCell className="text-zinc-400">{c.phone}</TableCell>
                              <TableCell className="text-right text-zinc-300">{sessions}</TableCell>
                              <TableCell className="text-right brand-text font-medium">
                                {coachRate != null ? `₹${(sessions * coachRate).toLocaleString("en-IN")}` : (
                                  <button type="button" onClick={() => setActiveTab("settings")} className="text-xs text-amber-400 hover:underline">Set rate</button>
                                )}
                              </TableCell>
                              <TableCell className="text-right"><LoginLinkButton userId={c.id} name={c.name} phone={c.phone} academyName={academyName} /></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
              <div>
                <SectionHeader title="Trial Bookings" description="Manage new trial requests" />
                <TrialManager trials={trials} />
              </div>
              <div>
                <SectionHeader title="Coach Verification" />
                <CoachVerification coaches={coaches.map((c: any) => ({ id: c.id, name: c.name, phone: c.phone || "", verified: c.verified || false, verificationData: c.verificationData }))} />
              </div>
              <div>
                <SectionHeader title="Upcoming Birthdays" description="Send wishes to build parent loyalty" />
                <BirthdayTracker students={students} />
              </div>
            </div>
          )}

          {/* BATCHES & FEES */}
          {activeTab === "batches" && (
            <div className="space-y-8">
              <div>
                <SectionHeader title="Batches" actions={<div className="flex gap-2"><GenerateSessionsButton /><CreateBatchDialog coaches={coaches} /></div>} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {batches.map((b: any) => (
                    <Card key={b.id} className="bg-zinc-900/30 border-zinc-800/50 hover:border-zinc-700/50 transition">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base">{b.name}</CardTitle>
                          <Badge variant="sky">{b.sport}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm text-zinc-400">{b.schedule || "No schedule"}</p>
                        <div className="flex justify-between text-xs text-zinc-500">
                          <span>Coach: {b.coach?.name}</span>
                          <span>{b.enrollments?.length || 0}{b.capacity ? `/${b.capacity}` : ""} students</span>
                        </div>
                        {b.capacity ? (
                          <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2">
                            <div className="brand-bar h-1.5 rounded-full transition-all" style={{ width: `${Math.min(((b.enrollments?.length || 0) / b.capacity) * 100, 100)}%` }} />
                          </div>
                        ) : (
                          <p className="text-[11px] text-zinc-600 mt-2">Capacity: —</p>
                        )}
                        <BatchFeeEditor batchId={b.id} monthlyFee={b.monthlyFee} capacity={b.capacity} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <SectionHeader title="Batch Transfer" />
                  <BatchTransfer students={students.map((s: any) => ({ id: s.id, name: s.name, enrollments: s.enrollments }))} batches={batches.map((b: any) => ({ id: b.id, name: b.name }))} />
                </div>
                <div className="space-y-6">
                  <div>
                    <SectionHeader title="Waitlist" />
                    <Deferred promise={secondary}>
                      {(d) => <WaitlistManager batches={batches.map((b: any) => ({ id: b.id, name: b.name, sport: b.sport }))} waitlist={d.waitlist} />}
                    </Deferred>
                  </div>
                  <div>
                    <CalendarExport batches={batches} />
                  </div>
                </div>
              </div>
              <div>
                <SectionHeader title="Holiday Calendar" />
                <HolidayManager />
              </div>
            </div>
          )}

          {/* FEES */}
          {activeTab === "fees" && (
            <div className="space-y-8">
              <div>
                <SectionHeader title="Payments to confirm" description={`${pendingVerification.length} reported by parents via UPI`} />
                {!upiId && (
                  <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-300">
                    Add your UPI ID in{" "}
                    <button type="button" onClick={() => setActiveTab("settings")} className="underline">Settings</button>{" "}
                    so parents can pay you directly.
                  </div>
                )}
                <PendingPayments items={pendingVerification} />
              </div>
              <div>
                <SectionHeader
                  title="Monthly Fees"
                  description={(() => {
                    const [y, m] = (currentMonth || "").split("-").map(Number);
                    if (!y || !m) return currentMonth;
                    return `Billing Cycle: ${new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`;
                  })()}
                  actions={<GenerateFeesButton />}
                />
                <div className="rounded-xl border border-zinc-800/50 overflow-hidden">
                  <div className="overflow-x-auto w-full custom-scrollbar">
                    <Table className="min-w-[560px]">
                      <TableHeader><TableRow className="border-zinc-800/50 bg-zinc-900/40 hover:bg-zinc-900/40">
                        <TableHead className="text-zinc-500 text-xs uppercase">Student</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase">Parent</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase text-right">Fee</TableHead>
                        <TableHead className="text-zinc-500 text-xs uppercase text-right">Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {students.map((s: any) => {
                          const feeRecord = s.feeRecords?.[0];
                          const feeStatus = feeRecord?.status || "PENDING";
                          const feeAmount = feeRecord?.amount || studentFees[s.id] || 0;
                          return (
                          <TableRow key={s.id} className="border-zinc-800/30 hover:bg-zinc-800/20">
                            <TableCell><a href={`/student/${s.id}`} className="brand-text hover:underline">{s.name}</a></TableCell>
                            <TableCell className="text-zinc-400 text-sm">{s.parent?.name}</TableCell>
                            <TableCell className="text-right text-sm">
                              {feeAmount > 0 ? <span className="text-zinc-200">₹{feeAmount.toLocaleString("en-IN")}</span> : (
                                <button type="button" onClick={() => setActiveTab("batches")} className="text-xs text-amber-400 hover:underline">Set fee</button>
                              )}
                            </TableCell>
                            <TableCell className="text-right flex items-center justify-end gap-2">
                              <FeeToggle studentId={s.id} month={currentMonth} initialStatus={feeStatus} />
                              {(feeStatus === "PENDING" || feeStatus === "PENDING_VERIFICATION") && s.parent?.phone && feeAmount > 0 && (
                                <>
                                  <PayNowButton studentName={s.name} studentId={s.id} amount={feeAmount} month={currentMonth} parentPhone={s.parent.phone} academyName={academyName} upiId={upiId} feeRecordId={feeRecord?.id} feeStatus={feeStatus} razorpayConnected={Boolean((org as any)?.razorpayConnected)} />
                                  {feeStatus === "PENDING" && (
                                    <WhatsAppReminder parentPhone={s.parent.phone} studentName={s.name} month={currentMonth} amount={feeAmount} academyName={academyName} upiId={upiId} />
                                  )}
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <SectionHeader title="Fee Plans" description="Monthly, quarterly & annual options" />
                  <Deferred promise={secondary}>
                    {(d) => <PaymentPlans academyName={academyName} feePlans={d.feePlans} />}
                  </Deferred>
                </div>
                <div>
                  <SectionHeader title="Coupons" />
                  <Deferred promise={secondary}>
                    {(d) => <CouponManager initialCoupons={d.coupons} />}
                  </Deferred>
                </div>
              </div>
            </div>
          )}

          {/* COMMUNICATION */}
          {activeTab === "communication" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <SectionHeader title="Announcements" description="Broadcast to all parents" />
                  <BroadcastTab adminId={session.id} />
                </div>
                <div>
                  <SectionHeader title="Direct Messages" />
                  <Deferred promise={secondary}>
                    {(d) => <InboxTab adminId={session.id} parents={d.parents} messages={d.messages} />}
                  </Deferred>
                </div>
              </div>
              <div>
                <AutoReminders />
              </div>
              <div>
                <SectionHeader title="WhatsApp Templates" description="Pre-built message templates for automated communication" />
                <WhatsAppTemplates />
              </div>
              <div>
                <SectionHeader title="Bulk WhatsApp" description="Send messages to multiple parents at once" />
                <BulkWhatsApp students={students} academyName={academyName} studentFees={studentFees} />
              </div>
            </div>
          )}

          {/* ANALYTICS */}
          {activeTab === "analytics" && (
            <div className="space-y-6">
              {/* `sessions` is unused by AnalyticsDashboard — no longer fetched/shipped */}
              <AnalyticsDashboard students={students} batches={batches} feeRecords={allFeeRecords} sessions={[]} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <RevenueProjection paidCount={stats.paidFeesCount} totalStudents={stats.totalStudents} ratePerStudent={stats.typicalFee ?? 0} collectedAmount={stats.revenueThisMonth} targetAmount={stats.billedThisMonth} />
                <CapacityAlerts batches={batches} />
              </div>
              <CoachPerformance coaches={coaches as any} sessionRate={coachRate} />
              <SectionHeader title="Export Data" />
              <Card className="bg-zinc-900/30 border-zinc-800/50 p-6">
                <ExportCSV students={exportStudents} />
              </Card>
            </div>
          )}

          {/* AI INSIGHTS */}
          {activeTab === "ai" && FEATURES.experimental && (
            <div className="space-y-6">
              <SectionHeader title="AI Insights" description="Smart predictions powered by your academy data" />
              
              <Deferred promise={secondary} fallback={<div className="space-y-6"><SectionSkeleton height={220} /><SectionSkeleton height={220} /></div>}>
                {({ analytics }) => (
                  <>
                    <AttendanceInsights data={analytics?.attendanceData} />
                    
                    <RevenueForecast data={analytics?.revenueData} feeRate={stats.typicalFee ?? 0} />
                    
                    <BatchHealthReport data={analytics?.batchHealthData} />
                    
                    <StudentGrowthTracker data={analytics?.studentGrowthData} />
                    
                    <ParentEngagement data={analytics?.parentEngagementData} />
                  </>
                )}
              </Deferred>
              
              <ChurnPredictor students={students} />
              <FeePricingAnalyzer currentFee={stats.typicalFee ?? 0} totalStudents={stats.totalStudents} city={org?.city || ""} />
            </div>
          )}

          {/* LEADS */}
          {activeTab === "leads" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <SectionHeader title="Lead Pipeline" description="Manage inquiries and track conversions" />
                <AddLeadForm orgId={session.orgId} />
              </div>
              <Deferred promise={secondary}>
                {(d) => <LeadPipeline initialLeads={leads} stats={d.leadStats} batches={batches} />}
              </Deferred>
            </div>
          )}

          {/* EVENTS */}
          {activeTab === "events" && FEATURES.events && (
            <div className="space-y-6">
              <SectionHeader title="Tournaments & Certificates" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TournamentBracket />
                <CertificateGenerator students={students.map((s: any) => ({ id: s.id, name: s.name }))} />
              </div>
            </div>
          )}

          {/* GALLERY */}
          {activeTab === "gallery" && (
            <div className="space-y-6">
              <SectionHeader title="Photo Gallery" description="Share training highlights with parents" />
              <Deferred promise={secondary}>
                {(d) => <PhotoGallery photos={d.galleryPhotos} userId={session.id} />}
              </Deferred>
            </div>
          )}

          {/* STORE */}
          {activeTab === "store" && (
            <div>
              <SectionHeader title="Kit Store" description="Manage products and orders" />
              <Deferred promise={secondary}>
                {(d) => <StoreManager products={d.products} orders={d.orders} />}
              </Deferred>
            </div>
          )}

          {/* MARKETING */}
          {activeTab === "marketing" && FEATURES.experimental && (
            <div className="space-y-6">
              <SectionHeader title="Marketing Hub" description="Grow your academy with social media & referrals" />
              <Deferred promise={secondary} fallback={<div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><SectionSkeleton /><SectionSkeleton /></div>}>
                {(d) => (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ReferralProgram academyName={academyName} totalStudents={stats.totalStudents} referrals={d.referrals} parents={d.parents} />
                    <TestimonialCollector academyName={academyName} testimonials={d.testimonials} parents={d.parents} />
                  </div>
                )}
              </Deferred>
              <div>
                <SectionHeader title="Content Calendar" description="Plan your social media posts for the month" />
                <ContentCalendar batches={batches} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <SectionHeader title="Instagram Post Generator" />
                  <InstagramGenerator academyName={academyName} stats={{ students: stats.totalStudents, batches: batches.length, sports: [...new Set(batches.map((b: any) => b.sport))].length }} sportNames={[...new Set(batches.map((b: any) => b.sport))].filter(Boolean)} />
                </div>
                <div>
                  <SectionHeader title="Quick Social Posts" />
                  <SocialPostGenerator academyName={academyName} stats={{ students: stats.totalStudents, batches: batches.length, sports: [...new Set(batches.map((b: any) => b.sport))].length }} />
                </div>
              </div>
            </div>
          )}

          {/* OPERATIONS */}
          {activeTab === "operations" && (
            <div className="space-y-6">
              <div>
                <SectionHeader title="Facilities & Equipment" />
                <Deferred promise={secondary}>
                  {(d) => <FacilitiesTab facilities={d.facilities} equipment={d.equipment} />}
                </Deferred>
              </div>
              <div>
                <SectionHeader title="Transport Routes" />
                <Deferred promise={secondary}>
                  {(d) => <TransportManager initialRoutes={d.transportRoutes} />}
                </Deferred>
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <SectionHeader title="Academy Settings" description="Manage your academy profile" />
              {org && <AcademySettings org={org} />}
              <div>
                <SectionHeader title="Import Data" description="Import students from WhatsApp, Excel or CSV" />
                <div className="mb-4">
                  <WhatsAppRosterImport existingBatches={batches} />
                </div>
                <ExcelImport />
              </div>
              <Card className="bg-zinc-900/30 border-zinc-800/50 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Data Management</h3>
                <ExportCSV students={exportStudents} />
                {SHOW_SEED && (
                  <div className="mt-8 pt-6 border-t border-zinc-800/50">
                    <h4 className="text-sm font-medium text-zinc-200 mb-1">Sample data</h4>
                    <p className="text-xs text-zinc-500 mb-3">Adds sample students, coaches, batches and fees to this academy (development only). You&apos;ll be asked to confirm.</p>
                    <SeedButton />
                  </div>
                )}
                <div className="mt-8 pt-6 border-t border-zinc-800/50">
                  <h4 className="text-sm font-medium text-rose-500 mb-2">Danger Zone</h4>
                  <button
                    onClick={async () => {
                      if (!confirm("⚠️ This will permanently delete ALL data (students, batches, fees, attendance, etc). Your admin account will be kept. Continue?")) return;
                      const { deleteAllData } = await import("@/app/actions/delete");
                      const result = await deleteAllData();
                      if (result?.success) {
                        alert("✅ " + result.message);
                        window.location.reload();
                      } else {
                        alert("❌ " + (result?.message || "Delete failed"));
                      }
                    }}
                    className="px-4 py-2 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500/20 transition text-sm border border-rose-500/20"
                  >Delete all data</button>
                </div>
              </Card>
            </div>
          )}
        </>
        );
      }}
    </DashboardShell>
  );
}
