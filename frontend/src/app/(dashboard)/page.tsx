"use client";

import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { useSidebar } from "@/src/app/(dashboard)/layout";
import { ChatNavbar } from "@/src/components/chat/ChatNavbar";
import { getIdToken } from "@/src/services/authService";
import { createSession } from "@/src/services/sessionService";

export default function DashboardPage() {
  const router = useRouter();
  const { toggle } = useSidebar();

  async function handleNewChat() {
    const token = await getIdToken();
    const session = await createSession(token, "New conversation");
    router.push(`/session/${session.sessionId}`);
  }

  return (
    <div className="flex h-full flex-col">
      <ChatNavbar onToggleSidebar={toggle} onNewChat={handleNewChat} />

      {/* Empty state */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <MessageSquarePlus className="h-12 w-12 text-neutral-300 dark:text-neutral-700" />
        <div>
          <p className="text-base font-medium text-neutral-700 dark:text-neutral-300">
            No conversation selected
          </p>
          <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">
            Pick one from the sidebar or start a new chat.
          </p>
        </div>
        <button
          onClick={handleNewChat}
          className="mt-2 flex items-center gap-2 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          New Chat
        </button>
      </div>
    </div>
  );
}
