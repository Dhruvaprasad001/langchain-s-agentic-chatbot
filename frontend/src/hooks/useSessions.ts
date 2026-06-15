"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UnauthenticatedError } from "@/src/services/authService";
import {
  createSession as apiCreate,
  deleteSession as apiDelete,
  listSessions as apiList,
} from "@/src/services/sessionService";
import type { Session } from "@/src/types";

interface UseSessionsReturn {
  sessions: Session[];
  loading: boolean;
  error: string | null;
  page: number;
  limit: number;
  total: number;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  refresh: () => Promise<void>;
  createSession: (title: string) => Promise<Session>;
  deleteSession: (sessionId: string) => Promise<void>;
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const router = useRouter();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiList(page, limit);
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
  }, [page, limit]);

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

  return { sessions, loading, error, page, limit, total, setPage, setLimit, refresh, createSession, deleteSession };
}
