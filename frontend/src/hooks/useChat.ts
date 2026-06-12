"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getIdToken } from "@/src/services/authService";
import { getSession } from "@/src/services/sessionService";
import { streamMessage } from "@/src/services/chatService";
import type { Message } from "@/src/types";

interface UseChatReturn {
  messages: Message[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  sendMessage: (content: string) => void;
}

function tempId() {
  return `tmp-${Date.now()}-${Math.random()}`;
}

export function useChat(sessionId: string): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track the message_id of the assistant bubble being streamed into
  const streamingIdRef = useRef<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const { messages: history } = await getSession(token, sessionId);
      setMessages(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  function sendMessage(content: string): void {
    if (sending || !content.trim()) return;
    setSending(true);
    setError(null);

    const userMsgId = tempId();
    const assistantMsgId = tempId();
    streamingIdRef.current = assistantMsgId;

    // Optimistically append user turn + empty assistant bubble
    const userMsg: Message = {
      messageId: userMsgId,
      role: "user",
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: Message = {
      messageId: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    getIdToken()
      .then((token) => {
        streamMessage(
          token,
          sessionId,
          content.trim(),
          (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.messageId === streamingIdRef.current
                  ? { ...m, content: m.content + delta }
                  : m,
              ),
            );
          },
          () => {
            setSending(false);
            streamingIdRef.current = null;
          },
          (err) => {
            setError(err.message);
            setSending(false);
            streamingIdRef.current = null;
          },
        );
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Auth error");
        setSending(false);
      });
  }

  return { messages, loading, sending, error, sendMessage };
}
