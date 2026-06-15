"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSession } from "@/src/services/sessionService";
import { streamMessage } from "@/src/services/chatService";
import type { Message, ThinkingStep } from "@/src/types";

interface UseChatReturn {
  messages: Message[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  sending: boolean;
  pendingReply: boolean;
  error: string | null;
  sendMessage: (content: string) => void;
}

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS  = 90_000;
const PAGE_LIMIT = 20;

function tempId() {
  return `tmp-${Date.now()}-${Math.random()}`;
}

export function useChat(sessionId: string): UseChatReturn {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]       = useState(false);
  const [sending, setSending]       = useState(false);
  const [pendingReply, setPending]  = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const streamingIdRef              = useRef<string | null>(null);
  const pollTimerRef                = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef                = useRef<number>(0);
  // Track which page of history we've loaded (oldest page we've fetched so far)
  const oldestPageRef               = useRef<number>(1);
  const totalMessagesRef            = useRef<number>(0);

  // ── Stop any running poll ────────────────────────────────────────────────
  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setPending(false);
  }

  // ── Poll until an assistant reply appears ────────────────────────────────
  function startPolling() {
    stopPolling();
    setPending(true);
    pollStartRef.current = Date.now();

    pollTimerRef.current = setInterval(async () => {
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        stopPolling();
        return;
      }
      try {
        // Poll the most-recent page only
        const { messages: fresh, total } = await getSession(sessionId, 1, PAGE_LIMIT);
        totalMessagesRef.current = total;
        const lastFresh = fresh[fresh.length - 1];
        if (lastFresh?.role === "assistant") {
          setMessages((prev) => {
            // Replace the most-recent PAGE_LIMIT messages with the fresh ones,
            // keeping any older pages that were already prepended.
            const olderMessages = prev.slice(0, Math.max(0, prev.length - PAGE_LIMIT));
            return [...olderMessages, ...fresh];
          });
          stopPolling();
        }
      } catch {
        // silent — keep polling
      }
    }, POLL_INTERVAL_MS);
  }

  // ── Load the initial (most-recent) page of history ───────────────────────
  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    oldestPageRef.current = 1;
    try {
      const { messages: history, total } = await getSession(sessionId, 1, PAGE_LIMIT);
      totalMessagesRef.current = total;
      setMessages(history);
      setHasMore(total > PAGE_LIMIT);

      const last = history[history.length - 1];
      if (last?.role === "user") {
        startPolling();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    loadHistory();
    return () => stopPolling();
  }, [loadHistory]);

  // ── Load an older page (prepend to the top) ───────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const nextOlderPage = oldestPageRef.current + 1;
    try {
      const { messages: older, total } = await getSession(sessionId, nextOlderPage, PAGE_LIMIT);
      totalMessagesRef.current = total;
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.messageId));
        const fresh = older.filter((m) => !existingIds.has(m.messageId));
        return [...fresh, ...prev];
      });
      oldestPageRef.current = nextOlderPage;
      // hasMore: total messages > messages we have loaded so far
      setHasMore(total > nextOlderPage * PAGE_LIMIT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more messages");
    } finally {
      setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, sessionId]);

  // ── Send a new message ─────────────────────────────────────────────────────
  function sendMessage(content: string): void {
    if (sending || !content.trim()) return;
    stopPolling();
    setSending(true);
    setError(null);

    const userMsgId      = tempId();
    const assistantMsgId = tempId();
    streamingIdRef.current = assistantMsgId;

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
      planSteps: [],
      thinkingSteps: [],
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    streamMessage(
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
      (step) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === streamingIdRef.current
              ? { ...m, planSteps: [...(m.planSteps ?? []), step] }
              : m,
          ),
        );
      },
      (stepLabel, status) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.messageId !== streamingIdRef.current) return m;
            const existing = m.thinkingSteps ?? [];
            if (status === "start") {
              return {
                ...m,
                thinkingSteps: [...existing, { label: stepLabel, status: "start" } as ThinkingStep],
              };
            }
            return {
              ...m,
              thinkingSteps: existing.map((s) =>
                s.label === stepLabel && s.status === "start"
                  ? { ...s, status: "done" as const }
                  : s,
              ),
            };
          }),
        );
      },
    );
  }

  return { messages, loading, loadingMore, hasMore, loadMore, sending, pendingReply, error, sendMessage };
}
