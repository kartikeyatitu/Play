"use client";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendMessage } from "@/app/actions/chat";
import { Send, Loader2 } from "lucide-react";

export function ChatWindow({ 
  currentUserId, 
  otherUserId, 
  otherUserName, 
  messages 
}: { 
  currentUserId: string, 
  otherUserId: string, 
  otherUserName: string,
  messages: any[] 
}) {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    
    setLoading(true);
    await sendMessage(currentUserId, otherUserId, content);
    setContent("");
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-[400px] bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800">
        <h3 className="font-bold text-zinc-100 flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
          {otherUserName}
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-600 text-sm italic">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${isMe ? "bg-cyan-600 text-white rounded-br-none" : "bg-zinc-800 text-zinc-200 rounded-bl-none"}`}>
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="bg-zinc-900 p-3 border-t border-zinc-800 flex gap-2">
        <Input 
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Type a message..."
          className="bg-zinc-950 border-zinc-800 text-zinc-200"
          disabled={loading}
        />
        <Button type="submit" size="icon" className="bg-cyan-500 hover:bg-cyan-600 text-zinc-950" disabled={loading || !content.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
}
