"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { Message } from "@/src/types";
import { MessageBubble } from "@/src/components/chat/MessageBubble";
import { Spinner } from "@/src/components/ui/Spinner";

interface MessageListProps {
  messages: Message[];
  sending?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => Promise<void>;
}

export function MessageList({
  messages,
  sending = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: MessageListProps) {
  const scrollRef  = useRef<HTMLDivElement>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const topRef     = useRef<HTMLDivElement>(null);

  // Track previous scrollHeight so we can restore scroll position after prepend
  const prevScrollHeightRef = useRef<number>(0);
  const prevMessageCountRef = useRef<number>(0);

  // Auto-scroll to bottom on new (outgoing) messages
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const currentCount = messages.length;

    if (currentCount > prevCount) {
      const addedAtBottom = currentCount - prevCount <= 2; // user send or stream tick
      if (addedAtBottom) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }

    prevMessageCountRef.current = currentCount;
  }, [messages]);

  // After prepending older messages restore scroll position so the view doesn't jump
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const newScrollHeight = el.scrollHeight;
    const diff = newScrollHeight - prevScrollHeightRef.current;
    if (diff > 0 && prevScrollHeightRef.current > 0) {
      el.scrollTop = el.scrollTop + diff;
    }
    prevScrollHeightRef.current = newScrollHeight;
  }, [messages]);

  // IntersectionObserver for the top sentinel — triggers loadMore
  useEffect(() => {
    const sentinel = topRef.current;
    if (!sentinel || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          // Save scroll height before fetch so we can restore after prepend
          if (scrollRef.current) {
            prevScrollHeightRef.current = scrollRef.current.scrollHeight;
          }
          onLoadMore();
        }
      },
      { root: scrollRef.current, threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  const lastIdx = messages.length - 1;

  return (
    <div
      ref={scrollRef}
      className="flex flex-1 flex-col overflow-y-auto"
      style={{ background: "var(--chat-bg)" }}
    >
      <div className="mx-auto w-full max-w-2xl flex-1 flex flex-col gap-6 px-4 py-8">

        {/* Top sentinel + loading indicator for older messages */}
        <div ref={topRef} className="h-1" />
        {loadingMore && (
          <div className="flex justify-center py-2">
            <Spinner size="sm" />
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble
            key={m.messageId}
            message={m}
            isStreaming={sending && i === lastIdx && m.role === "assistant"}
          />
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
