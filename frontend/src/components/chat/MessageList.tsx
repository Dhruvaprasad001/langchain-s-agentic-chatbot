"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/src/types";
import { MessageBubble } from "@/src/components/chat/MessageBubble";

interface MessageListProps {
  messages: Message[];
  sending?: boolean;
}

export function MessageList({ messages, sending = false }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const lastIdx = messages.length - 1;

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-6">
      {messages.map((m, i) => (
        <MessageBubble
          key={m.messageId}
          message={m}
          isStreaming={sending && i === lastIdx && m.role === "assistant"}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
