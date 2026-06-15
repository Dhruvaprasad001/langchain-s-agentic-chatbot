"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/src/hooks/useChat";
import { useSidebar } from "@/src/app/(dashboard)/layout";
import { ChatNavbar } from "@/src/components/chat/ChatNavbar";
import { MessageList } from "@/src/components/chat/MessageList";
import { ChatInput } from "@/src/components/chat/ChatInput";
import { Spinner } from "@/src/components/ui/Spinner";
import { createSession, getSessionTitle } from "@/src/services/sessionService";

export default function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const { messages, loading, sending, pendingReply, error, sendMessage } = useChat(sessionId);
  const { toggle, refreshSessions } = useSidebar();
  const router = useRouter();

  const [sessionTitle, setSessionTitle] = useState<string | undefined>(undefined);
  const isFirstMessageRef = useRef(true);
  const prevSendingRef = useRef(false);

  // fetch title once on mount
  useEffect(() => {
    isFirstMessageRef.current = true;
    getSessionTitle(sessionId)
      .then((title) => {
        if (title !== undefined) {
          setSessionTitle(title);
          if (title !== "New conversation") {
            isFirstMessageRef.current = false;
          }
        }
      })
      .catch(() => {});
  }, [sessionId]);

  // after the first message finishes streaming, re-fetch the title and refresh the sidebar
  useEffect(() => {
    const wasSending = prevSendingRef.current;
    prevSendingRef.current = sending;

    if (wasSending && !sending && isFirstMessageRef.current) {
      isFirstMessageRef.current = false;
      setTimeout(() => {
        getSessionTitle(sessionId)
          .then((title) => { if (title !== undefined) setSessionTitle(title); })
          .catch(() => {});
        refreshSessions();
      }, 800);
    }
  }, [sending, sessionId, refreshSessions]);

  async function handleNewChat() {
    const session = await createSession("New conversation");
    router.push(`/session/${session.sessionId}`);
  }

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--chat-bg)" }}>
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
            <div className="mx-auto mb-2 flex w-full max-w-2xl items-center gap-2 px-4 text-xs text-zinc-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
              Waiting for response…
            </div>
          )}
        </>
      )}

      {error && (
        <p className="px-4 pb-1 text-center text-xs text-red-400">{error}</p>
      )}

      <ChatInput onSend={sendMessage} disabled={sending || loading || pendingReply} />
    </div>
  );
}
