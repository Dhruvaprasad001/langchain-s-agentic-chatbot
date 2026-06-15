"use client";

import { PanelLeft, SquarePen } from "lucide-react";

interface ChatNavbarProps {
  title?: string;
  onToggleSidebar: () => void;
  onNewChat: () => void;
}

export function ChatNavbar({ title, onToggleSidebar, onNewChat }: ChatNavbarProps) {
  return (
    <header
      className="relative flex h-13 shrink-0 items-center justify-between px-4 backdrop-blur-md"
      style={{
        background: "rgba(15,15,17,0.8)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <button
        onClick={onToggleSidebar}
        title="Toggle sidebar"
        className="rounded-lg p-1.5 text-zinc-500 transition-all hover:bg-white/5 hover:text-zinc-200"
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      {title && (
        <span className="pointer-events-none absolute inset-x-0 mx-auto max-w-[55%] truncate text-center text-sm font-medium text-zinc-300">
          {title}
        </span>
      )}

      <button
        onClick={onNewChat}
        title="New chat"
        className="rounded-lg p-1.5 text-zinc-500 transition-all hover:bg-white/5 hover:text-zinc-200"
      >
        <SquarePen className="h-4 w-4" />
      </button>
    </header>
  );
}
