"use client";
import { useState } from "react";
import { seedDemoData } from "@/app/actions/seed";
import { toast } from "sonner";

export function SeedButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        if (!confirm("Load demo data? This adds sample students, coaches, batches and fees to YOUR academy. Only use this on an empty test academy.")) return;
        setLoading(true);
        try {
          const result = await seedDemoData();
          if (result?.success) {
            toast.success(result.message || "Demo data loaded!");
            window.location.reload();
          } else {
            toast.error(result?.message || "Seeding failed");
          }
        } catch (e: any) {
          toast.error(e?.message || "Seeding failed — try refreshing the page first");
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
    >
      {loading ? "Seeding..." : "Load Demo Data"}
    </button>
  );
}
