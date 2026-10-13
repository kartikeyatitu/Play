"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChatWindow } from "@/components/chat/ChatWindow";

export function InboxTab({ adminId, parents, messages }: { adminId: string, parents: any[], messages: any[] }) {
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  const selectedParent = parents.find(p => p.id === selectedParentId);
  const activeMessages = selectedParent ? messages.filter(
    m => (m.senderId === adminId && m.receiverId === selectedParentId) || 
         (m.senderId === selectedParentId && m.receiverId === adminId)
  ) : [];

  return (
    <Card className="bg-zinc-900/40 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-xl">Communications</CardTitle>
        <CardDescription>Direct messages with parents.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row gap-4">
        {/* Contact List */}
        <div className="w-full md:w-1/3 bg-zinc-950 border border-zinc-800 rounded-lg overflow-y-auto h-[400px]">
          {parents.map(parent => (
            <button
              key={parent.id}
              onClick={() => setSelectedParentId(parent.id)}
              className={`w-full text-left p-4 border-b border-zinc-800 transition-colors ${selectedParentId === parent.id ? "bg-zinc-900 border-l-2 border-l-cyan-500" : "hover:bg-zinc-900/50"}`}
            >
              <p className="font-bold text-zinc-100">{parent.name}</p>
              <p className="text-xs text-zinc-500">{parent.phone}</p>
            </button>
          ))}
        </div>

        {/* Chat Window */}
        <div className="w-full md:w-2/3">
          {selectedParent ? (
            <ChatWindow 
              currentUserId={adminId} 
              otherUserId={selectedParent.id} 
              otherUserName={selectedParent.name} 
              messages={activeMessages} 
            />
          ) : (
            <div className="h-[400px] flex items-center justify-center bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-600">
              Select a parent to start messaging
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
