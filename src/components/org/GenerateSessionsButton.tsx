"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { generateTodaySessions } from "@/app/actions/auto-sessions";

export function GenerateSessionsButton() {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await generateTodaySessions();
      toast.success(`Generated ${result.created} sessions (skipped ${result.skipped})`);
    } catch (error) {
      toast.error("Failed to generate sessions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleGenerate} disabled={loading} variant="default">
      {loading ? "Generating..." : "Generate Today's Sessions"}
    </Button>
  );
}
