"use client";

import { useRouter } from "next/navigation";
import { useSessions } from "@/src/hooks/useSessions";
import { SessionCard } from "@/src/components/session/SessionCard";
import { Spinner } from "@/src/components/ui/Spinner";

export default function DashboardPage() {
  const router = useRouter();
  const { sessions, loading, error, createSession, deleteSession } = useSessions();

  async function handleNewChat() {
    const session = await createSession("New conversation");
    router.push(`/session/${session.sessionId}`);
  }

  function handleSelect(sessionId: string) {
    router.push(`/session/${sessionId}`);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Your conversations
        </h1>
        <button
          onClick={handleNewChat}
          className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <Spinner size="md" />
          </div>
        )}

        {!loading && error && (
          <p className="text-center text-sm text-red-500">{error}</p>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-400">
            <p className="text-sm">No conversations yet.</p>
            <button
              onClick={handleNewChat}
              className="text-sm underline underline-offset-4 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              Start your first chat
            </button>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div className="flex flex-col gap-1">
            {sessions.map((session) => (
              <SessionCard
                key={session.sessionId}
                session={session}
                onSelect={handleSelect}
                onDelete={deleteSession}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
