"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addHighlightReel } from "@/app/actions/media";
import { Loader2, Video } from "lucide-react";
import { toast } from "sonner";

export function AddMediaModal({
  studentId,
  coachId,
  studentName,
  trigger,
}: {
  studentId: string;
  coachId: string;
  studentName: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = (await addHighlightReel(studentId, coachId, title, videoUrl)) as { success?: boolean; error?: string } | undefined;
      if (res && res.success === false) {
        toast.error(res.error || "Failed to add highlight reel.");
        return;
      }
      toast.success("Highlight shared with the parent");
      setOpen(false);
      setTitle("");
      setVideoUrl("");
    } catch {
      toast.error("Failed to add highlight reel.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="inline-flex cursor-pointer">
          {trigger}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Upload Highlight Video"
          className="w-8 h-8 rounded-xl bg-zinc-850 hover:bg-purple-500/20 text-zinc-400 hover:text-purple-400 border border-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
        >
          <Video className="w-3.5 h-3.5" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-purple-400" />
              <span>Add Highlight Video · {studentName}</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">Highlight Title</label>
              <Input
                required
                placeholder="e.g. Clean cover drive, penalty save"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-zinc-900 border-zinc-800 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">Video URL (YouTube or Google Drive)</label>
              <Input
                required
                placeholder="https://..."
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="bg-zinc-900 border-zinc-800 rounded-xl"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Highlight Video
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
