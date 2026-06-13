"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/src/hooks/useChat";
import { useSidebar } from "@/src/app/(dashboard)/layout";
import { ChatNavbar } from "@/src/components/chat/ChatNavbar";
import { MessageList } from "@/src/components/chat/MessageList";
import { ChatInput } from "@/src/components/chat/ChatInput";
import { Spinner } from "@/src/components/ui/Spinner";
import { getIdToken } from "@/src/services/authService";
import { createSession, getSession } from "@/src/services/sessionService";

export default function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const { messages, loading, sending, pendingReply, error, sendMessage } = useChat(sessionId);
  const { toggle } = useSidebar();
  const router = useRouter();

  const [sessionTitle, setSessionTitle] = useState<string | undefined>(undefined);

  // fetch title once on mount
  useEffect(() => {
    getIdToken()
      .then((token) => getSession(token, sessionId))
      .then(({ session }) => setSessionTitle(session.title))
      .catch(() => {});
  }, [sessionId]);

  async function handleNewChat() {
    const token = await getIdToken();
    const session = await createSession(token, "New conversation");
    router.push(`/session/${session.sessionId}`);
  }

  return (
    <div className="flex h-full flex-col">
      <ChatNavbar
        title={sessionTitle}
        onToggleSidebar={toggle}
        onNewChat={handleNewChat}
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : (
        <>
          <MessageList messages={messages} sending={sending} />
          {pendingReply && !sending && (
            <div className="mx-auto mb-2 flex w-full max-w-2xl items-center gap-2 px-4 text-xs text-zinc-400">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-400" />
              Waiting for response…
            </div>
          )}
        </>
      )}

      {error && (
        <p className="px-4 pb-1 text-center text-xs text-red-500">{error}</p>
      )}

      <ChatInput onSend={sendMessage} disabled={sending || loading || pendingReply} />
    </div>
  );
}
