"use client";

import { useRouter } from "next/navigation";
import { Sparkles, MessageSquarePlus } from "lucide-react";
import { useSidebar } from "@/src/app/(dashboard)/layout";
import { ChatNavbar } from "@/src/components/chat/ChatNavbar";
import { UnauthenticatedError } from "@/src/services/authService";
import { createSession } from "@/src/services/sessionService";

const SUGGESTIONS = [
  "Explain quantum entanglement simply",
  "Write a Python script to rename files",
  "What's the best way to learn TypeScript?",
  "Summarize the latest trends in AI",
];

export default function DashboardPage() {
  const router = useRouter();
  const { toggle } = useSidebar();

  async function handleNewChat(initialMessage?: string) {
    try {
      const session = await createSession("New conversation");
      router.push(`/session/${session.sessionId}`);
    } catch (err) {
      if (err instanceof UnauthenticatedError) {
        router.replace("/login");
      }
    }
  }

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--chat-bg)" }}>
      <ChatNavbar onToggleSidebar={toggle} onNewChat={() => handleNewChat()} />

      <div className="flex flex-1 flex-col items-center justify-center px-4">
        {/* Hero */}
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-2xl shadow-indigo-900/40 ring-1 ring-white/10">
            <Sparkles className="h-7 w-7 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
              What can I help with?
            </h1>
            <p className="mt-1.5 text-sm text-zinc-500">
              Ask anything, or pick a suggestion below
            </p>
          </div>
        </div>

        {/* Suggestion chips */}
        <div className="mb-10 grid w-full max-w-lg grid-cols-2 gap-2.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleNewChat(s)}
              className="rounded-xl px-4 py-3 text-left text-sm text-zinc-400 ring-1 ring-white/8 transition-all hover:bg-white/5 hover:text-zinc-200 hover:ring-white/15"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => handleNewChat()}
          className="flex items-center gap-2.5 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-xl shadow-indigo-950/50 transition-all hover:bg-indigo-500 hover:shadow-indigo-900/60"
        >
          <MessageSquarePlus className="h-4 w-4" strokeWidth={2} />
          New Conversation
        </button>
      </div>
    </div>
  );
}
