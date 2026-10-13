"use client";
import { useState, useEffect, useCallback } from "react";

interface TourStep {
  tabId: string;
  title: string;
  description: string;
  icon: string;
}

const TOUR_STEPS: TourStep[] = [
  { tabId: "overview", title: "Overview", icon: "📊", description: "Your daily numbers — students, revenue, attendance at a glance." },
  { tabId: "people", title: "People", icon: "👥", description: "Manage students, coaches, and parent contacts." },
  { tabId: "batches", title: "Batches", icon: "🏟️", description: "Training groups, schedules, and waitlists." },
  { tabId: "fees", title: "Fees", icon: "💰", description: "Track payments, send reminders, manage plans." },
  { tabId: "communication", title: "Messages", icon: "💬", description: "WhatsApp templates, broadcasts, and direct chat." },
  { tabId: "analytics", title: "Analytics", icon: "📈", description: "Charts, revenue trends, and capacity alerts." },
  { tabId: "ai", title: "AI Insights", icon: "🧠", description: "AI-powered attendance analysis and revenue forecasting." },
  { tabId: "marketing", title: "Marketing", icon: "📣", description: "Referrals, testimonials, content calendar." },
  { tabId: "settings", title: "Settings", icon: "⚙️", description: "Import data, export CSV, academy profile." },
];

interface ProductTourProps {
  onNavigate: (tabId: string) => void;
  isFirstVisit?: boolean;
}

export function ProductTour({ onNavigate, isFirstVisit = false }: ProductTourProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlight, setSpotlight] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 100, left: 160 });

  // Find and highlight the sidebar nav item
  const highlightTarget = useCallback((stepIndex: number) => {
    const step = TOUR_STEPS[stepIndex];
    // Find sidebar nav button by matching text content
    const navButtons = document.querySelectorAll("nav button, aside button");
    let target: Element | null = null;

    navButtons.forEach((btn) => {
      const text = btn.textContent?.trim().toLowerCase() || "";
      const label = step.title.toLowerCase();
      if (text.includes(label) || (label === "messages" && text.includes("messages")) || (label === "ai insights" && text.includes("ai"))) {
        target = btn;
      }
    });

    if (target) {
      const rect = (target as HTMLElement).getBoundingClientRect();
      const padding = 6;
      setSpotlight({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
      // Position tooltip to the right of the sidebar item
      setTooltipPos({
        top: Math.min(rect.top, window.innerHeight - 220),
        left: rect.right + 20,
      });
    } else {
      // Fallback: center of screen
      setSpotlight(null);
      setTooltipPos({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - 160,
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Small delay to let DOM settle after tab navigation
      const timer = setTimeout(() => highlightTarget(currentStep), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, currentStep, highlightTarget]);

  // Handle resize
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => highlightTarget(currentStep);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, currentStep, highlightTarget]);

  // Auto-show only on the first visit in this browser (persisted in localStorage)
  useEffect(() => {
    if (isFirstVisit) {
      let seen: string | null = null;
      try { seen = localStorage.getItem("sportsos_tour_v2") || sessionStorage.getItem("sportsos_tour_v2"); } catch {}
      if (!seen) {
        setTimeout(() => {
          setIsOpen(true);
          setCurrentStep(0);
          onNavigate(TOUR_STEPS[0].tabId);
        }, 1000);
      }
    }
  }, [isFirstVisit, onNavigate]);

  const handleDismiss = () => {
    setIsOpen(false);
    try { localStorage.setItem("sportsos_tour_v2", "true"); } catch {}
    sessionStorage.setItem("sportsos_tour_v2", "true");
  };

  const goTo = (index: number) => {
    setCurrentStep(index);
    onNavigate(TOUR_STEPS[index].tabId);
  };

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      goTo(currentStep + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) goTo(currentStep - 1);
  };

  // Handle keyboard
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
      if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const step = TOUR_STEPS[currentStep];

  // Trigger button
  if (!isOpen) {
    return (
      <button
        onClick={() => { setIsOpen(true); goTo(0); }}
        className="group flex items-center gap-2 px-3 py-1.5 text-xs bg-gradient-to-r from-violet-500/10 to-pink-500/10 text-violet-400 rounded-lg hover:from-violet-500/20 hover:to-pink-500/20 transition-all border border-violet-500/20 hover:border-violet-500/40"
      >
        <span className="group-hover:scale-110 transition-transform">🎓</span>
        <span className="hidden sm:inline">Tour</span>
      </button>
    );
  }

  return (
    <>
      {/* Darkened overlay with spotlight cutout */}
      <div
        className="fixed inset-0 z-[200] transition-opacity duration-300"
        onClick={handleDismiss}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

        {/* Spotlight hole */}
        {spotlight && (
          <div
            className="absolute rounded-xl transition-all duration-300 ease-out"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
              boxShadow: "0 0 0 4px rgba(139, 92, 246, 0.5)",
              background: "transparent",
              // Cut a hole in the overlay using a massive box-shadow inset trick
              // Actually we'll just clear this area
            }}
          >
            {/* Pulsing ring */}
            <div className="absolute inset-0 rounded-xl border-2 border-violet-400 animate-pulse" />
          </div>
        )}
      </div>

      {/* Clear the spotlight area (make it transparent) */}
      {spotlight && (
        <div
          className="fixed z-[201] rounded-xl pointer-events-none"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            // This recreates the background behind the overlay
            backgroundColor: "transparent",
            boxShadow: "0 0 0 0 transparent",
          }}
        />
      )}

      {/* Tooltip Card */}
      <div
        className="fixed z-[202] transition-all duration-300 ease-out"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arrow pointing left to the sidebar item */}
        <div className="absolute -left-2 top-6 w-0 h-0 border-t-[8px] border-t-transparent border-r-[8px] border-r-zinc-800 border-b-[8px] border-b-transparent" />

        <div className="w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{step.icon}</span>
                <h3 className="text-sm font-semibold text-white">{step.title}</h3>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">
                {currentStep + 1}/{TOUR_STEPS.length}
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Progress bar */}
          <div className="px-4 py-2">
            <div className="flex gap-0.5">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-0.5 flex-1 rounded-full transition-all ${
                    i <= currentStep ? "bg-violet-500" : "bg-zinc-800"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/50 bg-zinc-950/50">
            <button
              onClick={handleDismiss}
              className="text-[11px] text-zinc-600 hover:text-zinc-400 transition"
            >
              Skip
            </button>
            <div className="flex gap-1.5">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition rounded-lg hover:bg-zinc-800"
                >
                  ←
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-4 py-1.5 text-xs bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition font-medium"
              >
                {currentStep === TOUR_STEPS.length - 1 ? "Done ✓" : "Next →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
