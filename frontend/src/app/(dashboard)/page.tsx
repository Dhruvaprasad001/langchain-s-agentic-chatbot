"use client";

import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { useSidebar } from "@/src/app/(dashboard)/layout";
import { ChatNavbar } from "@/src/components/chat/ChatNavbar";
import { getIdToken, UnauthenticatedError } from "@/src/services/authService";
import { createSession } from "@/src/services/sessionService";

export default function DashboardPage() {
  const router = useRouter();
  const { toggle } = useSidebar();

  async function handleNewChat() {
    try {
      const token = await getIdToken();
      const session = await createSession(token, "New conversation");
      router.push(`/session/${session.sessionId}`);
    } catch (err) {
      if (err instanceof UnauthenticatedError) {
        router.replace("/login");
      }
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ChatNavbar onToggleSidebar={toggle} onNewChat={handleNewChat} />

      {/* Empty state */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <MessageSquarePlus className="h-12 w-12 text-neutral-300" />
        <div>
          <p className="text-base font-medium text-neutral-700">
            No conversation selected
          </p>
          <p className="mt-1 text-sm text-neutral-400">
            Pick one from the sidebar or start a new chat.
          </p>
        </div>
        <button
          onClick={handleNewChat}
          className="mt-2 flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          New Chat
        </button>
      </div>
    </div>
  );
}
