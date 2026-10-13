"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { broadcastAnnouncement } from "@/app/actions/announcements";
import { Megaphone, Loader2 } from "lucide-react";

export function BroadcastTab({ adminId }: { adminId: string }) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    
    await broadcastAnnouncement(title, message, adminId);
    
    setTitle("");
    setMessage("");
    setSuccess(true);
    setLoading(false);
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <Card className="bg-zinc-900/40 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-lime-400" /> Broadcast Center
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Push an instant notice to all parents in the academy (e.g. Rain Delays, Holidays).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label className="text-zinc-400">Subject</Label>
            <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Practice Cancelled Today" className="bg-zinc-900 border-zinc-800" />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-400">Message</Label>
            <textarea required value={message} onChange={(e) => setMessage(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm min-h-32 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-400 text-white" placeholder="Type your message here..."></textarea>
          </div>
          <Button disabled={loading} type="submit" className="bg-lime-400 text-zinc-950 font-bold hover:bg-lime-500 w-full sm:w-auto">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Megaphone className="w-4 h-4 mr-2" />}
            {success ? "Broadcast Sent!" : "Send to All Parents"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
