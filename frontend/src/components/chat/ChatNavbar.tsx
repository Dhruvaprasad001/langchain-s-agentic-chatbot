"use client";

import { PanelLeft, SquarePen } from "lucide-react";

interface ChatNavbarProps {
  title?: string;
  onToggleSidebar: () => void;
  onNewChat: () => void;
}

export function ChatNavbar({ title, onToggleSidebar, onNewChat }: ChatNavbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-950">
      {/* Left: toggle sidebar */}
      <button
        onClick={onToggleSidebar}
        title="Toggle sidebar"
        className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      {/* Centre: session title */}
      <span className="absolute left-1/2 -translate-x-1/2 max-w-[50%] truncate text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {title ?? "New conversation"}
      </span>

      {/* Right: new chat */}
      <button
        onClick={onNewChat}
        title="New chat"
        className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      >
        <SquarePen className="h-4 w-4" />
      </button>
    </header>
  );
}
