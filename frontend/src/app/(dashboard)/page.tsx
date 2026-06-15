"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
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
      <div className="flex flex-1 flex-col  items-center justify-center gap-4 text-center">
        <div>
          <p className="-mt-18 text-[1rem] text-neutral-400">
            Pick one from the sidebar or start a new chat.
          </p>
        </div>
        <button
          onClick={handleNewChat}
          className=" flex items-center gap-2 -mt-10 rounded-lg bg-indigo-600 px-5 py-2.5 text-[1rem] font-medium text-white transition hover:bg-indigo-500"
        >
          New Chat
        </button>
      </div>
    </div>
  );
}
