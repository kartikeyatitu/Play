"use client";

import { useState, useEffect, useCallback, ReactNode, CSSProperties } from "react";
import {
  LayoutDashboard, Users, CalendarDays, CreditCard,
  MessageSquare, BarChart3, Settings, X, Menu,
  GraduationCap, Dumbbell, Trophy, Bell,
  ShoppingBag, Building2, Ticket, Home,
  Heart, Star, Send, Grid, CalendarCheck, CalendarClock,
  Wallet, MoreHorizontal,
} from "lucide-react";
import { SectionHeader as ShellSectionHeader } from "@/components/shell/SectionHeader";

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  /** Primary sections. In grouped mode (moreGroups set) this is the 5-item bottom bar; the last item (id "more") is the hub. */
  navItems: NavItem[];
  defaultTab: string;
  children: (activeTab: string, setActiveTab: (tab: string) => void) => ReactNode;
  headerActions?: ReactNode;
  /**
   * Grouped "More" list shown in the desktop sidebar. When provided the shell uses the
   * 5-item bottom bar (no drawer) and every item here stays reachable under "More".
   */
  moreGroups?: NavGroup[];
  /** Per-academy brand colour (#rrggbb). Falls back to the Triq lime (--brand in globals.css). */
  brandColor?: string | null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function DashboardShell({ title, subtitle, navItems, defaultTab, children, headerActions, moreGroups, brandColor }: DashboardShellProps) {
  const grouped = !!moreGroups;
  const [activeTab, setActiveTabState] = useState(defaultTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const moreItems = (moreGroups ?? []).flatMap((g) => g.items);
  const moreIds = new Set(moreItems.map((i) => i.id));
  const allIds = new Set([...navItems.map((n) => n.id), ...moreIds]);
  const idsKey = [...allIds].join("|");

  // Keep the current section in the URL (?tab=) without a navigation / refetch
  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    setMobileMenuOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === defaultTab) url.searchParams.delete("tab");
      else url.searchParams.set("tab", tab);
      if (tab !== "people") url.searchParams.delete("page");
      window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
      window.scrollTo({ top: 0 });
    }
  }, [defaultTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam && idsKey.split("|").includes(tabParam)) setActiveTabState(tabParam);
  }, [idsKey]);

  const brandStyle: CSSProperties | undefined =
    brandColor && HEX.test(brandColor) ? ({ "--brand": brandColor } as CSSProperties) : undefined;

  const initial = (title.trim()[0] || "T").toUpperCase();

  // ── Navigation pieces ──────────────────────────────────────────────────────────
  const sidebarPrimary = grouped ? navItems.filter((n) => n.id !== "more") : navItems;

  const NavButton = ({ item, small = false }: { item: NavItem; small?: boolean }) => {
    const isActive = activeTab === item.id;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(item.id)}
        aria-current={isActive ? "page" : undefined}
        className={`w-full flex items-center gap-2.5 rounded-lg px-3 text-left transition-colors ${
          small ? "min-h-[36px] text-[13px]" : "min-h-[40px] text-sm"
        } ${
          isActive
            ? "bg-zinc-850 text-ink font-medium"
            : "text-ink-muted hover:text-ink hover:bg-zinc-850/60"
        }`}
      >
        <span className={`shrink-0 ${isActive ? "text-ink" : "text-ink-subtle"}`}>{item.icon}</span>
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  const renderSidebarContent = () => (
    <>
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg brand-bg flex items-center justify-center font-semibold text-[15px] shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink truncate leading-tight tracking-[-0.01em]">{title}</p>
            <p className="text-[11px] text-ink-subtle leading-tight mt-0.5">Powered by Triq</p>
          </div>
        </div>
        {mobileMenuOpen && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
            className="p-2.5 rounded-lg border border-line text-ink-muted hover:text-ink"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-2 pb-3 space-y-0.5 overflow-y-auto custom-scrollbar">
        {sidebarPrimary.map((item) => (
          <NavButton key={item.id} item={item} />
        ))}

        {grouped && (
          <div className="pt-4 space-y-4">
            {moreGroups!.map((group) => (
              <div key={group.label}>
                <p className="px-3 mb-1 text-[12px] font-medium text-ink-subtle">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavButton key={item.id} item={item} small />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </nav>
    </>
  );

  // Legacy (ungrouped) mode — used by the parent portal: first 4 in the bar + "More" drawer
  const primaryMobileTabs = navItems.slice(0, 4);
  const isPrimaryActive = primaryMobileTabs.some((t) => t.id === activeTab);

  // Grouped mode — which bottom-bar item is highlighted (sub-pages light up "More")
  const barActiveId = navItems.some((n) => n.id === activeTab) ? activeTab : moreIds.has(activeTab) ? "more" : "";

  return (
    <div className="min-h-screen bg-canvas flex relative" style={brandStyle}>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 border-r border-line bg-surface flex-col sticky top-0 h-screen z-30">
        {renderSidebarContent()}
      </aside>

      {/* Legacy mobile drawer */}
      {!grouped && mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[rgb(8_10_13/0.45)] backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="w-72 max-w-[85vw] border-r border-line bg-surface flex flex-col h-screen relative shadow-2xl animate-in slide-in-from-left duration-200">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 min-w-0 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:pb-10">
        <header className="sticky top-0 z-20 bg-canvas/85 backdrop-blur-md border-b border-line px-4 sm:px-8 py-2.5 sm:py-3">
          <div className="flex justify-between items-center gap-3 min-h-[44px]">
            <div className="flex items-center gap-2.5 min-w-0">
              {!grouped && (
                <button
                  type="button"
                  className="lg:hidden w-11 h-11 -ml-1 flex items-center justify-center rounded-xl border border-line text-zinc-300 hover:text-ink"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open navigation menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
              {grouped && (
                <div className="lg:hidden w-8 h-8 rounded-lg brand-bg flex items-center justify-center font-semibold text-[15px] shrink-0">
                  {initial}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-[15px] font-semibold text-ink truncate tracking-[-0.01em]">{title}</h1>
                {subtitle && <p className="text-xs text-ink-subtle truncate tabular-nums">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">{headerActions}</div>
          </div>
        </header>

        <div key={activeTab} className="tab-in px-4 py-5 sm:px-8 sm:py-8 max-w-6xl mx-auto min-w-0 overflow-x-hidden">
          {children(activeTab, setActiveTab)}
        </div>
      </main>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Primary"
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-surface/95 backdrop-blur-md border-t border-line pb-safe"
      >
        <div className="flex items-stretch px-1">
          {(grouped ? navItems : primaryMobileTabs).map((tab) => {
            const isActive = grouped ? barActiveId === tab.id : activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`press relative flex-1 min-h-[56px] min-w-0 flex flex-col items-center justify-center gap-0.5 ${
                  isActive ? "brand-text" : "text-ink-subtle hover:text-zinc-300"
                }`}
              >
                {isActive && <span className="absolute top-0 inset-x-5 h-0.5 rounded-full brand-bar" />}
                <span className="[&>svg]:w-5 [&>svg]:h-5">{tab.icon}</span>
                <span className="text-[10px] font-medium tracking-tight truncate max-w-full px-1">{tab.label}</span>
              </button>
            );
          })}
          {!grouped && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={`relative flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                !isPrimaryActive ? "brand-text" : "text-ink-subtle hover:text-zinc-300"
              }`}
            >
              {!isPrimaryActive && <span className="absolute top-0 inset-x-4 h-0.5 rounded-full brand-bar" />}
              <Grid className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight">More</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}

// Stat Card (legacy — still used by the parent portal)
interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  gradient: string;
  textColor: string;
}

export function StatCard({ label, value, icon, gradient, textColor }: StatCardProps) {
  return (
    <div className={`rounded-xl border border-line/60 bg-gradient-to-br ${gradient} p-4 sm:p-5`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[13px] font-medium text-ink-muted">{label}</p>
          <p className={`text-xl sm:text-2xl font-semibold mt-1.5 tabular-nums ${textColor}`}>{value}</p>
        </div>
        <div className={`${textColor} opacity-60`}>{icon}</div>
      </div>
    </div>
  );
}

// Section Header — implemented in shell/ so every screen shares one style
export const SectionHeader = ShellSectionHeader;

// Export icon components
export const NAV_ICONS = {
  overview: <LayoutDashboard className="w-4 h-4" />,
  today: <CalendarCheck className="w-4 h-4" />,
  bookings: <CalendarClock className="w-4 h-4" />,
  wallet: <Wallet className="w-4 h-4" />,
  more: <MoreHorizontal className="w-4 h-4" />,
  people: <Users className="w-4 h-4" />,
  batches: <CalendarDays className="w-4 h-4" />,
  fees: <CreditCard className="w-4 h-4" />,
  communication: <MessageSquare className="w-4 h-4" />,
  analytics: <BarChart3 className="w-4 h-4" />,
  settings: <Settings className="w-4 h-4" />,
  students: <GraduationCap className="w-4 h-4" />,
  gym: <Dumbbell className="w-4 h-4" />,
  trophy: <Trophy className="w-4 h-4" />,
  bell: <Bell className="w-4 h-4" />,
  shop: <ShoppingBag className="w-4 h-4" />,
  building: <Building2 className="w-4 h-4" />,
  ticket: <Ticket className="w-4 h-4" />,
  home: <Home className="w-4 h-4" />,
  heart: <Heart className="w-4 h-4" />,
  star: <Star className="w-4 h-4" />,
  send: <Send className="w-4 h-4" />,
};
