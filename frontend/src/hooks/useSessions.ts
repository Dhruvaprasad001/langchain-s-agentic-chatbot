"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getIdToken, UnauthenticatedError } from "@/src/services/authService";
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
  refresh: () => Promise<void>;
  createSession: (title: string) => Promise<Session>;
  deleteSession: (sessionId: string) => Promise<void>;
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleAuthError(err: unknown): never {
    if (err instanceof UnauthenticatedError) {
      router.replace("/login");
    }
    throw err;
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const data = await apiList(token);
      setSessions(data);
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function createSession(title: string): Promise<Session> {
    setError(null);
    try {
      const token = await getIdToken();
      const session = await apiCreate(token, title);
      await refresh();
      return session;
    } catch (err) {
      handleAuthError(err);
      const msg = err instanceof Error ? err.message : "Failed to create session";
      setError(msg);
      throw err;
    }
  }

  async function deleteSession(sessionId: string): Promise<void> {
    setError(null);
    try {
      const token = await getIdToken();
      await apiDelete(token, sessionId);
      await refresh();
    } catch (err) {
      handleAuthError(err);
      const msg = err instanceof Error ? err.message : "Failed to delete session";
      setError(msg);
      throw err;
    }
  }

  return { sessions, loading, error, refresh, createSession, deleteSession };
}
