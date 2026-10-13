"use client";
import { Video } from "lucide-react";

export function MediaFeed({ media }: { media: any[] }) {
  if (!media || media.length === 0) return null;

  return (
    <div className="pt-4 border-t border-zinc-800">
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <Video className="w-4 h-4" /> Coach Highlights
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {media.map((m: any) => (
          <a 
            key={m.id} 
            href={m.videoUrl} 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center gap-3 bg-zinc-950 p-3 rounded-lg border border-purple-500/20 hover:border-purple-500/50 transition-colors"
          >
            <div className="w-10 h-10 rounded bg-purple-500/20 text-purple-400 flex flex-shrink-0 items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-zinc-200">{m.title}</p>
              <p className="text-xs text-zinc-500">{new Date(m.createdAt).toLocaleDateString()}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
