"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { markAttendance } from "@/app/actions/attendance";
import { flushQueue, istToday, readQueue } from "@/lib/attendance-queue";
import { QUEUE_EVENT } from "@/components/coach/AttendanceToggle";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Shows how many marks are waiting on this phone and sends them when the connection returns. */
export function AttendanceSync() {
  const router = useRouter();
  const [waiting, setWaiting] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [offline, setOffline] = useState(false);

  const refreshCount = useCallback(() => setWaiting(readQueue(storage()).length), []);

  const sync = useCallback(async () => {
    if (syncing || readQueue(storage()).length === 0) return refreshCount();
    if (navigator.onLine === false) return;
    setSyncing(true);
    try {
      const res = await flushQueue(storage(), istToday(), (m) => markAttendance(m.batchId, m.studentId, m.status));
      if (res.sent > 0) toast.success(`Synced ${res.sent} attendance mark${res.sent === 1 ? "" : "s"}.`);
      if (res.failed > 0) toast.error(`${res.failed} mark${res.failed === 1 ? "" : "s"} couldn't be saved (for example, the session was cancelled). Please check them.`);
      if (res.stale > 0) toast.error(`${res.stale} mark${res.stale === 1 ? "" : "s"} from an earlier day couldn't be synced. Please ask your admin to correct that day.`);
      if (res.sent > 0 || res.failed > 0) router.refresh();
    } finally {
      setSyncing(false);
      refreshCount();
    }
  }, [syncing, refreshCount, router]);

  useEffect(() => {
    setOffline(navigator.onLine === false);
    refreshCount();
    void sync();
    const online = () => {
      setOffline(false);
      void sync();
    };
    const off = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", off);
    window.addEventListener(QUEUE_EVENT, refreshCount);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", off);
      window.removeEventListener(QUEUE_EVENT, refreshCount);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!offline && waiting === 0) return null;
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm text-ink">
      <span className="inline-flex items-center gap-2">
        <CloudOff className="w-4 h-4 text-warn" aria-hidden />
        {offline ? "You're offline. Attendance is saved on this phone." : `${waiting} mark${waiting === 1 ? "" : "s"} waiting to sync.`}
        {offline && waiting > 0 ? ` ${waiting} waiting.` : ""}
      </span>
      {!offline && waiting > 0 && (
        <button type="button" onClick={() => void sync()} disabled={syncing} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold hover:bg-surface-2">
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync now
        </button>
      )}
    </div>
  );
}
