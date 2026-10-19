"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAcademyWorkspace } from "@/app/actions/onboarding";
import { Loader2, Sparkles, PlusCircle, Check } from "lucide-react";
import { toast } from "sonner";

const SPORTS = [
  { name: "Football", icon: "⚽" },
  { name: "Cricket", icon: "🏏" },
  { name: "Badminton", icon: "🏸" },
  { name: "Tennis", icon: "🎾" },
  { name: "Basketball", icon: "🏀" },
  { name: "Swimming", icon: "🏊" },
  { name: "Martial Arts", icon: "🥋" },
  { name: "Athletics", icon: "🏃" },
  { name: "Other", icon: "🏅" },
];

const BUSINESS_TYPES = [
  { value: "ACADEMY", label: "Academy", hint: "Batches, students, fees", icon: "🎓" },
  { value: "TURF", label: "Turf / court", hint: "Slot bookings", icon: "🏟️" },
  { value: "BOTH", label: "Both", hint: "Academy + bookings", icon: "⚡" },
] as const;

type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("ACADEMY");
  const [city, setCity] = useState("");
  const [sports, setSports] = useState<string[]>(["Football"]);
  const [loadSampleData, setLoadSampleData] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTurf = businessType === "TURF";
  const nameLabel = isTurf ? "Venue name" : businessType === "BOTH" ? "Academy / venue name" : "Academy name";

  const toggleSport = (s: string) =>
    setSports((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError(`Please enter your ${nameLabel.toLowerCase()} (at least 2 characters).`);
    if (sports.length === 0) return setError("Pick at least one sport.");
    if (city.trim().length < 2) return setError("Please enter your city.");

    setLoading(true);
    setError(null);
    try {
      const res = await createAcademyWorkspace({
        academyName: name,
        businessType,
        city: city.trim(),
        sports: sports as any,
        loadSampleData: loadSampleData && !isTurf,
      });
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        setLoading(false);
      } else if (res.success) {
        toast.success(`Welcome to Triq! ${name.trim()} is ready.`);
        window.location.href = (res as { redirect?: string }).redirect || "/org";
      }
    } catch {
      setError("Something went wrong creating your workspace. Please try again.");
      setLoading(false);
    }
  };

  const labelCls = "text-xs font-bold text-zinc-300 uppercase tracking-wider pl-1";

  return (
    <div className="min-h-screen bg-zinc-950 bg-grid bg-orbs flex flex-col items-center justify-center p-4 text-zinc-50 font-sans page-transition">
      <div className="w-full max-w-lg space-y-6 bg-zinc-900/40 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-zinc-800/60 shadow-2xl relative glass">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime-400/10 border border-lime-400/20 text-lime-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" /> Quick setup · under a minute
          </div>
          <h1 className="text-3xl font-black tracking-tight uppercase italic gradient-text">TRIQ</h1>
          <p className="text-zinc-400 text-sm">Tell us about your business to set up your workspace</p>
        </div>

        {error && (
          <div role="alert" className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* What do you run? */}
          <div className="space-y-2">
            <span className={labelCls}>What do you run?</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="What do you run?">
              {BUSINESS_TYPES.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  role="radio"
                  aria-checked={businessType === b.value}
                  onClick={() => setBusinessType(b.value)}
                  className={`flex flex-col items-center gap-1 p-3 min-h-[76px] rounded-xl border text-center transition-all ${
                    businessType === b.value
                      ? "bg-lime-400/15 border-lime-400 text-lime-300 shadow-sm"
                      : "bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  <span className="text-xl">{b.icon}</span>
                  <span className="text-xs font-bold">{b.label}</span>
                  <span className="text-[10px] text-zinc-500 leading-tight">{b.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label htmlFor="biz-name" className={`${labelCls} flex items-center justify-between`}>
              <span>{nameLabel}</span>
              <span className="text-[11px] text-zinc-500 font-normal lowercase">required</span>
            </label>
            <Input
              id="biz-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              placeholder={isTurf ? "e.g. Greenfield Turf, Sector 57" : "e.g. Spartan Sports Academy"}
              className="bg-zinc-900 border-zinc-800 text-white h-12 text-base focus-visible:ring-lime-400"
            />
          </div>

          {/* City */}
          <div className="space-y-2">
            <label htmlFor="biz-city" className={labelCls}>City</label>
            <Input
              id="biz-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              maxLength={60}
              placeholder="e.g. London, Dubai, Mumbai, New York"
              className="bg-zinc-900 border-zinc-800 text-white h-12 text-base focus-visible:ring-lime-400"
            />
          </div>

          {/* Sports (multi) */}
          <div className="space-y-2">
            <span className={`${labelCls} flex items-center justify-between`}>
              <span>Sport(s)</span>
              <span className="text-[11px] text-zinc-500 font-normal lowercase">pick all that apply</span>
            </span>
            <div className="grid grid-cols-3 gap-2">
              {SPORTS.map((s) => {
                const on = sports.includes(s.name);
                return (
                  <button
                    key={s.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleSport(s.name)}
                    className={`flex items-center gap-2 p-2.5 min-h-[44px] rounded-xl border text-xs font-medium transition-all ${
                      on
                        ? "bg-lime-400/15 border-lime-400 text-lime-300 font-bold shadow-sm"
                        : "bg-zinc-900/60 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                  >
                    <span className="text-base">{s.icon}</span>
                    <span className="truncate">{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Starting data (academy / both only) */}
          {!isTurf && (
            <div className="space-y-2 pt-1">
              <span className={labelCls}>Setup preference</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  aria-pressed={!loadSampleData}
                  onClick={() => setLoadSampleData(false)}
                  className={`text-left p-3.5 rounded-2xl border transition-all ${
                    !loadSampleData ? "bg-lime-400/10 border-lime-400/80 text-white" : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-zinc-200 flex items-center gap-1">
                      <PlusCircle className="w-3.5 h-3.5" /> Clean slate
                    </span>
                    {!loadSampleData && <Check className="w-4 h-4 text-lime-400" />}
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">Start with 0 students, ready for your real admissions.</p>
                </button>
                <button
                  type="button"
                  aria-pressed={loadSampleData}
                  onClick={() => setLoadSampleData(true)}
                  className={`text-left p-3.5 rounded-2xl border transition-all ${
                    loadSampleData ? "bg-lime-400/10 border-lime-400/80 text-white" : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-lime-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Sample data
                    </span>
                    {loadSampleData && <Check className="w-4 h-4 text-lime-400" />}
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">8 sample students, batches and fees to explore. Delete anytime.</p>
                </button>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 text-base bg-lime-400 text-zinc-950 hover:bg-lime-500 font-black uppercase tracking-wide rounded-xl shadow-lg shadow-lime-400/10 transition-all"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Launching workspace...
              </span>
            ) : (
              "Launch my workspace 🚀"
            )}
          </Button>
        </form>

        <p className="text-center text-[11px] text-zinc-500">
          Your workspace has strict multi-tenant data isolation and privacy.
        </p>
      </div>
    </div>
  );
}
