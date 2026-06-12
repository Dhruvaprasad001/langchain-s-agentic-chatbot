"use client";

import { use } from "react";

// TODO: use useChat(sessionId) hook to load history and send messages
// TODO: render MessageList + ChatInput
export default function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);

  return (
    <div className="flex h-full flex-col">
      {/* TODO: <MessageList messages={messages} streaming={streaming} /> */}
      {/* TODO: <ChatInput onSend={sendMessage} disabled={streaming} /> */}
      <p className="p-4 text-sm text-neutral-400">Session: {sessionId}</p>
    </div>
  );
}
