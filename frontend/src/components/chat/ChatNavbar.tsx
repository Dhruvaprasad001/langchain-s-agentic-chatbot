"use client";

import { PanelLeft, SquarePen } from "lucide-react";

interface ChatNavbarProps {
  title?: string;
  onToggleSidebar: () => void;
  onNewChat: () => void;
}

export function ChatNavbar({ title, onToggleSidebar, onNewChat }: ChatNavbarProps) {
  return (
    <header className="relative flex h-13 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4">
      <button
        onClick={onToggleSidebar}
        title="Toggle sidebar"
        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      {/* Centred title — uses absolute so it's always truly centred */}
      {title && (
        <span className="pointer-events-none absolute inset-x-0 mx-auto max-w-[55%] truncate text-center text-[0.875rem] font-medium text-zinc-600">
          {title}
        </span>
      )}

      <button
        onClick={onNewChat}
        title="New chat"
        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition-colors"
      >
        <SquarePen className="h-4 w-4" />
      </button>
    </header>
  );
}
