"use client";

import { usePathname } from "next/navigation";
import { SquarePen, MessageSquareDot, Trash2, LogOut } from "lucide-react";
import { Spinner } from "@/src/components/ui/Spinner";
import { formatSessionDate } from "@/src/lib/formatDate";
import type { Session } from "@/src/types";

interface SessionSidebarProps {
  sessions: Session[];
  loading: boolean;
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onLogout: () => void;
}

export function SessionSidebar({
  sessions,
  loading,
  open,
  onClose,
  onNewChat,
  onSelectSession,
  onDelete,
  onLogout,
}: SessionSidebarProps) {
  const pathname = usePathname();
  const activeId = pathname.startsWith("/session/") ? pathname.split("/session/")[1] : null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/20"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-30 flex w-64 flex-col
          border-r border-zinc-200 bg-white
          transition-transform duration-200 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4">
          <span className="text-base font-bold tracking-tight text-zinc-900">
            Xenon AI
          </span>
          <button
            onClick={onNewChat}
            title="New chat"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <SquarePen className="h-4 w-4" />
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {loading && (
            <div className="flex justify-center py-8">
              <Spinner size="sm" />
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <MessageSquareDot className="h-8 w-8 text-zinc-300" />
              <p className="text-xs text-zinc-400">No conversations yet</p>
              <button
                onClick={onNewChat}
                className="text-xs font-medium text-indigo-500 hover:text-indigo-700"
              >
                Start one →
              </button>
            </div>
          )}

          {!loading && sessions.map((s) => {
            const isActive = s.sessionId === activeId;
            return (
              <div
                key={s.sessionId}
                onClick={() => { onSelectSession(s.sessionId); onClose(); }}
                className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${
                  isActive ? "bg-zinc-100" : "hover:bg-zinc-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${isActive ? "font-medium text-zinc-900" : "text-zinc-600"}`}>
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-3xs text-zinc-400">
                    {formatSessionDate(s.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(s.sessionId); }}
                  title="Delete"
                  className="ml-2 hidden rounded-md p-1 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:flex"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Logout */}
        <div className="border-t border-zinc-200 px-3 py-3">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
