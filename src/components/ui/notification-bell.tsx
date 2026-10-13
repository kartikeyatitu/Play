"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { getRecentNotifications } from "@/app/actions/notifications";

export function NotificationBell({ userId, initialCount }: { userId: string, initialCount: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const handleOpen = async () => {
    if (!isOpen) {
      const msgs = await getRecentNotifications(userId);
      setNotifications(msgs);
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <button onClick={handleOpen} className="relative p-2 rounded-full hover:bg-zinc-800 transition">
        <Bell className="w-5 h-5 text-zinc-100" />
        {initialCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {initialCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50">
          <div className="p-3 border-b border-zinc-800">
            <h3 className="font-semibold text-zinc-100">Notifications</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-zinc-500">No new notifications</div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className="p-3 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition">
                  <div className="font-medium text-sm text-zinc-100">{notif.sender.name}</div>
                  <div className="text-sm text-zinc-400 truncate mt-1">
                    {notif.content.substring(0, 50)}
                    {notif.content.length > 50 ? "..." : ""}
                  </div>
                  <div className="text-xs text-zinc-500 mt-2">
                    {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
