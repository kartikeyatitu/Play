"use client";

import { useState } from "react";
import { AtRiskStudentsView } from "@/components/org/AtRiskStudents";
import type { AtRiskSummary } from "@/lib/risk-data";

/** The academy's at-risk list, limited to this coach's batches (data loaded on the server). */
export function CoachAtRisk({ data }: { data: AtRiskSummary }) {
  const [showLow, setShowLow] = useState(false);
  return <AtRiskStudentsView data={data} showLow={showLow} onToggleLow={() => setShowLow((v) => !v)} />;
}
