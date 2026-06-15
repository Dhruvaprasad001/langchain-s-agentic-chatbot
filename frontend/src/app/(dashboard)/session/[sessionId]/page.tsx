"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useChat } from "@/src/hooks/useChat";
import { useSidebar } from "@/src/app/(dashboard)/layout";
import { ChatNavbar } from "@/src/components/chat/ChatNavbar";
import { MessageList } from "@/src/components/chat/MessageList";
import { ChatInput } from "@/src/components/chat/ChatInput";
import { Spinner } from "@/src/components/ui/Spinner";
import { createSession } from "@/src/services/sessionService";

function SessionPageInner({ sessionId }: { sessionId: string }) {
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get("q");

  const { messages, loading, loadingMore, hasMore, loadMore, sending, pendingReply, error, sendMessage } = useChat(sessionId);
  const { toggle, sessions, refreshSessions } = useSidebar();
  const router = useRouter();

  const [sessionTitle, setSessionTitle] = useState<string | undefined>(undefined);
  const isFirstMessageRef = useRef(true);
  const prevSendingRef = useRef(false);
  const autoSentRef = useRef(false);

  // derive title from the already-fetched sessions list in sidebar context
  useEffect(() => {
    isFirstMessageRef.current = true;
    const match = sessions.find((s) => s.sessionId === sessionId);
    if (match) {
      setSessionTitle(match.title);
      if (match.title !== "New conversation") {
        isFirstMessageRef.current = false;
      }
    }
  }, [sessionId, sessions]);

  // auto-send the suggestion message once the session has loaded
  useEffect(() => {
    if (!loading && initialMessage && !autoSentRef.current) {
      autoSentRef.current = true;
      sendMessage(initialMessage);
      // clean the URL without triggering a Next.js navigation / remount
      window.history.replaceState(null, "", `/session/${sessionId}`);
    }
  }, [loading, initialMessage, sendMessage, sessionId]);

  // after the first message finishes streaming, refresh the sidebar (which updates sessions in context, updating title reactively)
  useEffect(() => {
    const wasSending = prevSendingRef.current;
    prevSendingRef.current = sending;

    if (wasSending && !sending && isFirstMessageRef.current) {
      isFirstMessageRef.current = false;
      setTimeout(() => {
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
          <MessageList
            messages={messages}
            sending={sending}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
          />
          {pendingReply && !sending && (
            <div className="mx-auto mb-2 flex w-full max-w-2xl items-center gap-2 px-4 text-xs text-zinc-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
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

export default function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  return (
    <Suspense fallback={
      <div className="flex h-full flex-1 items-center justify-center" style={{ background: "var(--chat-bg)" }}>
        <Spinner size="md" />
      </div>
    }>
      <SessionPageInner sessionId={sessionId} />
    </Suspense>
  );
}
