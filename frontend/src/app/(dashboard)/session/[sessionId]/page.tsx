"use client";

import { use } from "react";
import { useChat } from "@/src/hooks/useChat";
import { MessageList } from "@/src/components/chat/MessageList";
import { ChatInput } from "@/src/components/chat/ChatInput";
import { Spinner } from "@/src/components/ui/Spinner";

export default function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const { messages, loading, sending, error, sendMessage } = useChat(sessionId);

  return (
    <div className="flex h-full flex-col">
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : (
        <MessageList messages={messages} sending={sending} />
      )}

      {error && (
        <p className="px-4 pb-1 text-center text-xs text-red-500">{error}</p>
      )}

      <ChatInput onSend={sendMessage} disabled={sending || loading} />
    </div>
  );
}
