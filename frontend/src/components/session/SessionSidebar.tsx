"use client";

import { useRouter, usePathname } from "next/navigation";
import { SquarePen, X, MessageSquare, Trash2 } from "lucide-react";
import { Spinner } from "@/src/components/ui/Spinner";
import type { Session } from "@/src/types";

interface SessionSidebarProps {
  sessions: Session[];
  loading: boolean;
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onDelete: (sessionId: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SessionSidebar({
  sessions,
  loading,
  open,
  onClose,
  onNewChat,
  onDelete,
}: SessionSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  // derive active session from URL
  const activeId = pathname.startsWith("/session/")
    ? pathname.split("/session/")[1]
    : null;

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-neutral-200
          bg-white transition-transform duration-200 dark:border-neutral-800 dark:bg-neutral-950
          md:relative md:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between px-4">
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Machi
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={onNewChat}
              title="New chat"
              className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              <SquarePen className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              title="Close sidebar"
              className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 md:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {loading && (
            <div className="flex justify-center py-8">
              <Spinner size="sm" />
            </div>
          )}

          {!loading && sessions.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <MessageSquare className="h-8 w-8 text-neutral-300 dark:text-neutral-700" />
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                No conversations yet
              </p>
              <button
                onClick={onNewChat}
                className="mt-1 text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                Start one
              </button>
            </div>
          )}

          {!loading && sessions.map((s) => {
            const isActive = s.sessionId === activeId;
            return (
              <div
                key={s.sessionId}
                onClick={() => router.push(`/session/${s.sessionId}`)}
                className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition-colors ${
                  isActive
                    ? "bg-neutral-100 dark:bg-neutral-800"
                    : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-800 dark:text-neutral-200">
                    {s.title}
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-600">
                    {formatDate(s.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(s.sessionId);
                  }}
                  title="Delete"
                  className="ml-2 hidden rounded p-1 text-neutral-400 hover:text-red-500 group-hover:block"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
