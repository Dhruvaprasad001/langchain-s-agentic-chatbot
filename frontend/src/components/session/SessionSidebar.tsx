"use client";

import { usePathname } from "next/navigation";
import { SquarePen, MessageSquareDot, Trash2, LogOut, Sparkles } from "lucide-react";
import { Spinner } from "@/src/components/ui/Spinner";
import { formatSessionDate } from "@/src/lib/formatDate";
import type { Session } from "@/src/types";
import Image from "next/image";

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
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-30 flex w-64 flex-col
          border-r bg-[#0a0a0c]
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        {/* Header */}
        <div
          className="flex h-14 shrink-0 items-center justify-between px-4"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/20 ring-1 ring-indigo-500/30">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" strokeWidth={2} />
            </div>
            <span className="text-sm font-semibold tracking-tight text-zinc-100">
              Xenon AI
            </span>
          </div>
          <button
            onClick={onNewChat}
            title="New chat"
            className="rounded-lg p-1.5 text-zinc-500 transition-all hover:bg-white/5 hover:text-zinc-200"
          >
            <SquarePen className="h-4 w-4" />
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {loading && (
            <div className="flex justify-center py-10">
              <Spinner size="sm" />
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                <MessageSquareDot className="h-5 w-5 text-zinc-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-400">No conversations yet</p>
                <p className="mt-0.5 text-xs text-zinc-600">Start a new chat to begin</p>
              </div>
              <button
                onClick={onNewChat}
                className="mt-1 rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-medium text-indigo-400 ring-1 ring-indigo-500/30 transition-all hover:bg-indigo-600/30 hover:text-indigo-300"
              >
                New chat →
              </button>
            </div>
          )}

          {!loading && sessions.map((s) => {
            const isActive = s.sessionId === activeId;
            return (
              <div
                key={s.sessionId}
                onClick={() => { onSelectSession(s.sessionId); onClose(); }}
                className={`group relative flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition-all ${
                  isActive
                    ? "bg-indigo-600/15 ring-1 ring-indigo-500/25"
                    : "hover:bg-white/5"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-indigo-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${isActive ? "font-medium text-zinc-100" : "text-zinc-400"}`}>
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-600">
                    {formatSessionDate(s.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(s.sessionId); }}
                  title="Delete"
                  className="ml-2 hidden rounded-md p-1 text-zinc-600 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:flex"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Logout */}
        <div className="px-3 py-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-500 transition-all hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
