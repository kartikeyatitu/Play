"use client";

import { useMemo, useState } from "react";
import { EvaluateModal } from "@/components/coach/EvaluateModal";
import { AthleteSpotlightModal } from "@/components/coach/AthleteSpotlightModal";
import { AttendanceAvatar } from "@/components/coach/squad/AttendanceAvatar";
import {
  attendanceStatusOf,
  parseMedicalInfo,
  shortMedicalLabel,
  statusIsPresent,
  type MedicalSeverity,
} from "@/lib/coach";
import { Search, X, Users, Star } from "lucide-react";

export interface StudentRecord {
  id: string;
  name: string;
  medicalInfo: string | null;
  bloodGroup: string | null;
  /** Optional: current-month fee pending. The "Fee due" chip only appears when the payload provides this. */
  feeDue?: boolean | null;
  parent?: {
    id?: string;
    name: string;
    phone: string | null;
    email?: string | null;
  } | null;
  skillReports?: {
    id: string;
    month: string;
    technique: number;
    fitness: number;
    discipline: number;
    notes?: string | null;
  }[];
  attendances?: {
    id?: string;
    sessionId?: string;
    isPresent: boolean;
    status?: string | null;
  }[];
}

export interface EnrollmentRecord {
  id: string;
  student: StudentRecord;
}

export interface BatchRecord {
  id: string;
  name: string;
  sport: string;
  schedule: string | null;
  monthlyFee: number | null;
  enrollments: EnrollmentRecord[];
}

interface CoachBatchRosterProps {
  batches: BatchRecord[];
  coachId: string;
  currentMonth: string;
}

type FilterTab = "ALL" | "WATCH" | "FEE_DUE" | "NOT_EVAL" | "LOW_ATT";

interface RosterItem {
  enrollmentId: string;
  batchId: string;
  batchName: string;
  batchLabel: string;
  batchSport: string;
  student: StudentRecord;
  /** % of the last 5 recorded attendances attended (LATE counts), null when there is no data. */
  attendancePct: number | null;
  report: NonNullable<StudentRecord["skillReports"]>[number] | null;
  isEvaluated: boolean;
  rating: number | null;
  severity: MedicalSeverity;
  medicalLabel: string | null;
  feeDue: boolean | null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "Cricket — U-14 Morning Champions" → "U-14 Morning Champions" (pill label only; full name stays in title). */
function shortBatchName(name: string, sport: string): string {
  if (!sport) return name;
  const re = new RegExp(`^\\s*${escapeRegExp(sport.trim())}\\s*[—–\\-:|·]\\s*`, "i");
  const stripped = name.replace(re, "").trim();
  return stripped || name;
}

export function CoachBatchRoster({ batches, coachId, currentMonth }: CoachBatchRosterProps) {
  // Batch-first default so the coach isn't faced with every athlete at once.
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batches[0]?.id || "ALL");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");

  const allStudents = useMemo<RosterItem[]>(() => {
    return batches.flatMap((b) =>
      b.enrollments.map((enr) => {
        const s = enr.student;
        const recent = (s.attendances || []).slice(0, 5);
        const attended = recent.filter((a) => {
          const st = attendanceStatusOf(a);
          return st ? statusIsPresent(st) : false;
        }).length;
        const attendancePct = recent.length > 0 ? Math.round((attended / recent.length) * 100) : null;

        const reports = s.skillReports || [];
        const report = reports.find((r) => r.month === currentMonth) ?? reports[0] ?? null;
        const rating = report
          ? Math.round(((report.technique + report.fitness + report.discipline) / 3) * 10) / 10
          : null;

        const medical = parseMedicalInfo(s.medicalInfo);

        return {
          enrollmentId: enr.id,
          batchId: b.id,
          batchName: b.name,
          batchLabel: shortBatchName(b.name, b.sport),
          batchSport: b.sport,
          student: s,
          attendancePct,
          report,
          isEvaluated: report !== null,
          rating,
          severity: medical.severity,
          medicalLabel: medical.severity === "alert" ? shortMedicalLabel(medical.summary) : null,
          feeDue: typeof s.feeDue === "boolean" ? s.feeDue : null,
        };
      })
    );
  }, [batches, currentMonth]);

  // Only offer the Fee due chip when fee data is actually present in the payload.
  const hasFeeData = useMemo(() => allStudents.some((i) => i.feeDue !== null), [allStudents]);

  const activeBatch = useMemo(
    () => (selectedBatchId === "ALL" ? null : batches.find((b) => b.id === selectedBatchId) || null),
    [batches, selectedBatchId]
  );

  const batchScoped = useMemo(
    () => (selectedBatchId === "ALL" ? allStudents : allStudents.filter((i) => i.batchId === selectedBatchId)),
    [allStudents, selectedBatchId]
  );

  const counts = useMemo(() => {
    const withAtt = batchScoped.filter((i) => i.attendancePct !== null);
    const avgAtt =
      withAtt.length > 0
        ? Math.round(withAtt.reduce((sum, i) => sum + (i.attendancePct ?? 0), 0) / withAtt.length)
        : null;
    return {
      total: batchScoped.length,
      watch: batchScoped.filter((i) => i.severity === "alert").length,
      feeDue: batchScoped.filter((i) => i.feeDue === true).length,
      notEval: batchScoped.filter((i) => !i.isEvaluated).length,
      lowAtt: batchScoped.filter((i) => i.attendancePct !== null && i.attendancePct < 60).length,
      avgAtt,
    };
  }, [batchScoped]);

  const filtered = useMemo(() => {
    let result = batchScoped;
    if (activeFilter === "WATCH") result = result.filter((i) => i.severity === "alert");
    else if (activeFilter === "FEE_DUE") result = result.filter((i) => i.feeDue === true);
    else if (activeFilter === "NOT_EVAL") result = result.filter((i) => !i.isEvaluated);
    else if (activeFilter === "LOW_ATT") result = result.filter((i) => i.attendancePct !== null && i.attendancePct < 60);

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (i) => i.student.name.toLowerCase().includes(q) || (i.student.parent?.name || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [batchScoped, activeFilter, searchQuery]);

  // Sequential "Evaluate batch": always targets the first athlete in scope still missing this month's review.
  const pendingEval = useMemo(() => {
    const seen = new Set<string>();
    return batchScoped.filter((i) => {
      if (i.isEvaluated || seen.has(i.student.id)) return false;
      seen.add(i.student.id);
      return true;
    });
  }, [batchScoped]);
  const nextToEvaluate = pendingEval[0] || null;

  function selectBatch(id: string) {
    setSelectedBatchId(id);
    setActiveFilter("ALL");
  }

  function toggleSearch() {
    if (searchOpen) setSearchQuery("");
    setSearchOpen((v) => !v);
  }

  const batchMeta: string[] = [];
  if (activeBatch) {
    if (activeBatch.schedule) batchMeta.push(activeBatch.schedule);
    if (activeBatch.monthlyFee) batchMeta.push(`₹${activeBatch.monthlyFee.toLocaleString("en-IN")}/mo`);
  } else {
    batchMeta.push(`All batches · ${allStudents.length} athletes`);
  }
  if (counts.avgAtt !== null) batchMeta.push(`${counts.avgAtt}% avg attendance`);

  const chips: { id: FilterTab; label: string; count: number; tone: "neutral" | "amber" | "rose" }[] = [
    { id: "ALL", label: "All", count: counts.total, tone: "neutral" },
    { id: "WATCH", label: "Watch", count: counts.watch, tone: "amber" },
    ...(hasFeeData ? [{ id: "FEE_DUE" as const, label: "Fee due", count: counts.feeDue, tone: "rose" as const }] : []),
    { id: "NOT_EVAL", label: "Not evaluated", count: counts.notEval, tone: "neutral" },
    ...(counts.lowAtt > 0 || activeFilter === "LOW_ATT"
      ? [{ id: "LOW_ATT" as const, label: "Low attendance", count: counts.lowAtt, tone: "rose" as const }]
      : []),
  ];

  function chipClass(id: FilterTab, tone: "neutral" | "amber" | "rose", count: number): string {
    const active = activeFilter === id;
    const base =
      "shrink-0 snap-start whitespace-nowrap inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full border text-[13px] font-semibold transition-colors";
    if (tone === "amber") {
      return `${base} ${
        active
          ? "bg-amber-400 border-amber-400 text-zinc-950"
          : count > 0
            ? "bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
            : "border-zinc-800 text-zinc-500"
      }`;
    }
    if (tone === "rose") {
      return `${base} ${
        active
          ? "bg-rose-500 border-rose-500 text-white"
          : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white"
      }`;
    }
    return `${base} ${
      active ? "bg-zinc-100 border-zinc-100 text-zinc-950" : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white"
    }`;
  }

  if (batches.length === 0) {
    return (
      <div className="min-w-0 space-y-4">
        <h2 className="text-2xl font-black tracking-tight text-white">Squad</h2>
        <div className="py-12 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mx-auto text-zinc-500">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-zinc-200">No batches assigned yet</p>
          <p className="text-xs text-zinc-500">Your academy admin can assign you to a batch.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 pb-24">
      {/* 1. Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-black tracking-tight text-white">Squad</h2>
        <button
          type="button"
          onClick={toggleSearch}
          aria-label={searchOpen ? "Close search" : "Search athletes"}
          aria-expanded={searchOpen}
          className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
        >
          {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
        </button>
      </div>

      {searchOpen && (
        <div className="relative min-w-0">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") toggleSearch();
            }}
            placeholder="Search by athlete or parent name"
            aria-label="Search athletes"
            className="w-full h-10 rounded-full bg-zinc-900 border border-zinc-800 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
          />
        </div>
      )}

      {/* 2. Batch switcher: one horizontal row, never stacks */}
      <div className="min-w-0 space-y-1.5">
        <div
          role="tablist"
          aria-label="Batches"
          className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory overscroll-x-contain"
        >
          {batches.map((b) => {
            const active = selectedBatchId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={active}
                title={b.name}
                onClick={() => selectBatch(b.id)}
                className={`shrink-0 snap-start whitespace-nowrap h-10 px-4 rounded-full text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[var(--brand)] text-[var(--brand-foreground)]"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {shortBatchName(b.name, b.sport)} · {b.enrollments.length}
              </button>
            );
          })}
          {batches.length > 1 && (
            <button
              type="button"
              role="tab"
              aria-selected={selectedBatchId === "ALL"}
              title="All batches"
              onClick={() => selectBatch("ALL")}
              className={`shrink-0 snap-start whitespace-nowrap h-10 px-4 rounded-full text-sm font-semibold transition-colors ${
                selectedBatchId === "ALL"
                  ? "bg-[var(--brand)] text-[var(--brand-foreground)]"
                  : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              All · {allStudents.length}
            </button>
          )}
        </div>
        {batchMeta.length > 0 && (
          <p className="truncate text-xs text-zinc-500 px-1" title={activeBatch?.name}>
            {batchMeta.join(" · ")}
          </p>
        )}
      </div>

      {/* 3. Filter chips: one scrollable row */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x overscroll-x-contain min-w-0">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={activeFilter === c.id}
            onClick={() => setActiveFilter(c.id)}
            className={chipClass(c.id, c.tone, c.count)}
          >
            <span>{c.label}</span>
            <span className={activeFilter === c.id ? "opacity-70" : "opacity-60"}>{c.count}</span>
          </button>
        ))}
      </div>

      {/* 4. Athlete list rows */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mx-auto text-zinc-500">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-zinc-200">No athletes found</p>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto">
            {searchQuery.trim()
              ? `Nobody matches "${searchQuery.trim()}".`
              : activeFilter === "NOT_EVAL"
                ? "Everyone in this batch has been evaluated this month."
                : "No athletes match this filter."}
          </p>
          {(searchQuery || activeFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setActiveFilter("ALL");
              }}
              className="h-8 px-4 rounded-full border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-zinc-800/60 min-w-0">
          {filtered.map((item) => {
            const s = item.student;
            const isAlert = item.severity === "alert";
            return (
              // AthleteSpotlightModal wraps its trigger in an inline-flex <span>; stretch it to a full-width row.
              <li key={item.enrollmentId} className="min-w-0 [&>span]:flex [&>span]:w-full [&>span]:min-w-0">
                <AthleteSpotlightModal
                  athlete={{
                    id: s.id,
                    name: s.name,
                    batchName: item.batchName,
                    batchSport: item.batchSport,
                    // Spotlight requires a number; keep the legacy 100 fallback when no attendance is recorded yet.
                    attendancePct: item.attendancePct ?? 100,
                    medicalInfo: s.medicalInfo,
                    bloodGroup: s.bloodGroup,
                    parent: s.parent,
                    skillReport: item.report,
                    attendances: s.attendances,
                  }}
                  coachId={coachId}
                  currentMonth={currentMonth}
                  trigger={
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${s.name}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          (e.currentTarget as HTMLElement).click();
                        }
                      }}
                      className="flex w-full min-w-0 items-center gap-3 py-3 px-1 text-left rounded-xl hover:bg-zinc-900/40 active:bg-zinc-900/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
                    >
                      <AttendanceAvatar name={s.name} pct={item.attendancePct} />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-bold text-white leading-tight">{s.name}</p>
                        <p className="truncate text-xs text-zinc-500 mt-0.5">
                          {isAlert && item.medicalLabel && (
                            <span className="text-amber-400 font-medium">{item.medicalLabel} · </span>
                          )}
                          {selectedBatchId === "ALL" && <span>{item.batchLabel} · </span>}
                          <span>
                            {item.attendancePct !== null ? `${item.attendancePct}% attendance` : "no attendance yet"}
                          </span>
                          <span> · </span>
                          {item.isEvaluated ? (
                            <span>evaluated</span>
                          ) : (
                            <span className="text-zinc-400">not evaluated</span>
                          )}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2.5">
                        {isAlert && (
                          <span
                            className="w-2 h-2 rounded-full bg-amber-400"
                            title={`Watch: ${item.medicalLabel || "medical alert"}`}
                            aria-label="Medical alert"
                          />
                        )}
                        {item.feeDue === true && (
                          <span className="text-xs font-bold text-rose-400" title="Fee due this month" aria-label="Fee due">
                            ₹
                          </span>
                        )}
                        {item.rating !== null && (
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-200 tabular-nums">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {item.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* 5. Floating "Evaluate batch": opens the existing EvaluateModal for the next unevaluated athlete.
          After saving, router.refresh() updates the payload and the pill moves on to the next athlete. */}
      {nextToEvaluate && (
        <div className="fixed right-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-30">
          <EvaluateModal
            key={nextToEvaluate.student.id}
            student={{ id: nextToEvaluate.student.id, name: nextToEvaluate.student.name }}
            existing={null}
            coachId={coachId}
            currentMonth={currentMonth}
            trigger={
              <div
                role="button"
                aria-label={`Evaluate batch: next is ${nextToEvaluate.student.name}, ${pendingEval.length} left`}
                title={`Next: ${nextToEvaluate.student.name}`}
                className="flex items-center gap-2 h-12 pl-5 pr-4 rounded-full bg-[var(--brand)] text-[var(--brand-foreground)] text-sm font-bold shadow-lg shadow-black/50 hover:brightness-110 active:scale-[0.98] transition select-none whitespace-nowrap"
              >
                <span>Evaluate batch</span>
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-black/15 text-xs font-black flex items-center justify-center tabular-nums">
                  {pendingEval.length}
                </span>
                <Star className="w-4 h-4" />
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}
