"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface SearchItem {
  type: "student" | "coach" | "batch" | "action";
  label: string;
  sublabel?: string;
  action: () => void;
}

interface CommandPaletteProps {
  students: { id: string; name: string; parent?: { name: string } }[];
  coaches: { id: string; name: string }[];
  batches: { id: string; name: string; sport: string }[];
  onNavigate: (tab: string) => void;
}

export function CommandPalette({ students, coaches, batches, onNavigate }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setQuery("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Build search items
  const allItems: SearchItem[] = [
    // Navigation actions
    { type: "action", label: "Go to Overview", sublabel: "Dashboard home", action: () => { onNavigate("overview"); setOpen(false); } },
    { type: "action", label: "Go to People", sublabel: "Students & Coaches", action: () => { onNavigate("people"); setOpen(false); } },
    { type: "action", label: "Go to Batches", sublabel: "Batch management", action: () => { onNavigate("batches"); setOpen(false); } },
    { type: "action", label: "Go to Fees", sublabel: "Fee collection", action: () => { onNavigate("fees"); setOpen(false); } },
    { type: "action", label: "Go to Messages", sublabel: "Announcements & chat", action: () => { onNavigate("communication"); setOpen(false); } },
    { type: "action", label: "Go to Analytics", sublabel: "Charts & reports", action: () => { onNavigate("analytics"); setOpen(false); } },
    { type: "action", label: "Go to AI Insights", sublabel: "Churn & pricing", action: () => { onNavigate("ai"); setOpen(false); } },
    { type: "action", label: "Go to Events", sublabel: "Tournaments", action: () => { onNavigate("events"); setOpen(false); } },
    { type: "action", label: "Go to Gallery", sublabel: "Photos", action: () => { onNavigate("gallery"); setOpen(false); } },
    { type: "action", label: "Go to Settings", sublabel: "Academy profile", action: () => { onNavigate("settings"); setOpen(false); } },
    // Students
    ...students.map(s => ({
      type: "student" as const,
      label: s.name,
      sublabel: `Student • Parent: ${s.parent?.name || "N/A"}`,
      action: () => { onNavigate("people"); setOpen(false); },
    })),
    // Coaches
    ...coaches.map(c => ({
      type: "coach" as const,
      label: c.name,
      sublabel: "Coach",
      action: () => { onNavigate("people"); setOpen(false); },
    })),
    // Batches
    ...batches.map(b => ({
      type: "batch" as const,
      label: b.name,
      sublabel: `Batch • ${b.sport}`,
      action: () => { onNavigate("batches"); setOpen(false); },
    })),
  ];

  const filtered = query.length === 0
    ? allItems.filter(i => i.type === "action") // show nav actions by default
    : allItems.filter(i =>
        i.label.toLowerCase().includes(query.toLowerCase()) ||
        i.sublabel?.toLowerCase().includes(query.toLowerCase())
      );

  // Arrow key navigation
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
    }
  };

  const typeIcons: Record<string, string> = {
    student: "🏃",
    coach: "👨🏫",
    batch: "📚",
    action: "→",
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative z-50 w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center border-b border-zinc-800 px-4">
          <span className="text-zinc-500 mr-2">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search students, coaches, batches..."
            className="flex-1 bg-transparent text-white py-3 outline-none placeholder:text-zinc-500"
            autoFocus
          />
          <kbd className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded">ESC</kbd>
        </div>
        <div className="max-h-[300px] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-6">No results found</p>
          )}
          {filtered.slice(0, 10).map((item, i) => (
            <button
              key={`${item.type}-${item.label}-${i}`}
              onClick={item.action}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                i === selectedIndex ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <span className="text-lg">{typeIcons[item.type]}</span>
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                {item.sublabel && <p className="text-xs text-zinc-500">{item.sublabel}</p>}
              </div>
            </button>
          ))}
        </div>
        <div className="border-t border-zinc-800 px-4 py-2 flex gap-4">
          <span className="text-xs text-zinc-600">↑↓ navigate</span>
          <span className="text-xs text-zinc-600">⏎ select</span>
          <span className="text-xs text-zinc-600">esc close</span>
        </div>
      </div>
    </div>
  );
}
