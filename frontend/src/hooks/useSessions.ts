"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UnauthenticatedError } from "@/src/services/authService";
import {
  createSession as apiCreate,
  deleteSession as apiDelete,
  listSessions as apiList,
} from "@/src/services/sessionService";
import type { Session } from "@/src/types";

const LIMIT = 20;

interface UseSessionsReturn {
  sessions: Session[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  total: number;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  createSession: (title: string) => Promise<Session>;
  deleteSession: (sessionId: string) => Promise<void>;
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const pageRef = useRef(1);
  const router = useRouter();

  const hasMore = sessions.length < total;

  // Reload from page 1, replacing the list
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    pageRef.current = 1;
    try {
      const data = await apiList(1, LIMIT);
      setSessions(data.items);
      setTotal(data.total);
    } catch (err) {
      if (err instanceof UnauthenticatedError) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Append next page to the existing list
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setError(null);
    const nextPage = pageRef.current + 1;
    try {
      const data = await apiList(nextPage, LIMIT);
      setSessions((prev) => {
        const existingIds = new Set(prev.map((s) => s.sessionId));
        const fresh = data.items.filter((s) => !existingIds.has(s.sessionId));
        return [...prev, ...fresh];
      });
      setTotal(data.total);
      pageRef.current = nextPage;
    } catch (err) {
      if (err instanceof UnauthenticatedError) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load more sessions");
    } finally {
      setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function createSession(title: string): Promise<Session> {
    setError(null);
    try {
      const session = await apiCreate(title);
      await refresh();
      return session;
    } catch (err) {
      if (err instanceof UnauthenticatedError) {
        router.replace("/login");
        throw err;
      }
      const msg = err instanceof Error ? err.message : "Failed to create session";
      setError(msg);
      throw err;
    }
  }

  async function deleteSession(sessionId: string): Promise<void> {
    setError(null);
    try {
      await apiDelete(sessionId);
      await refresh();
    } catch (err) {
      if (err instanceof UnauthenticatedError) {
        router.replace("/login");
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to delete session";
      setError(msg);
      throw err;
    }
  }

  return { sessions, loading, loadingMore, hasMore, error, total, loadMore, refresh, createSession, deleteSession };
}
