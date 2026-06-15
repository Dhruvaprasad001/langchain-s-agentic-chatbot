"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { SessionSidebar } from "@/src/components/session/SessionSidebar";
import { useSessions } from "@/src/hooks/useSessions";
import { signOutUser, UnauthenticatedError } from "@/src/services/authService";

// ── Sidebar context — lets child pages toggle and query sidebar state ─────────

interface SidebarContextValue {
  open: boolean;
  toggle: () => void;
  refreshSessions: () => Promise<void>;
}

const SidebarContext = createContext<SidebarContextValue>({
  open: true,
  toggle: () => {},
  refreshSessions: async () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const { sessions, loading, createSession, deleteSession, refresh } = useSessions();

  const toggle = useCallback(() => setOpen((v) => !v), []);

  async function handleNewChat() {
    try {
      const session = await createSession("New conversation");
      router.push(`/session/${session.sessionId}`);
    } catch (err) {
      if (err instanceof UnauthenticatedError) {
        router.replace("/login");
      }
    }
  }

  function handleSelectSession(sessionId: string) {
    router.push(`/session/${sessionId}`);
  }

  async function handleDelete(sessionId: string) {
    try {
      await deleteSession(sessionId);
      if (typeof window !== "undefined" && window.location.pathname.includes(sessionId)) {
        router.push("/");
      }
    } catch (err) {
      if (err instanceof UnauthenticatedError) {
        router.replace("/login");
      }
    }
  }

  async function handleLogout() {
    await signOutUser();
    router.replace("/login");
  }

  return (
    <SidebarContext.Provider value={{ open, toggle, refreshSessions: refresh }}>
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>
        <SessionSidebar
          sessions={sessions}
          loading={loading}
          open={open}
          onClose={() => setOpen(false)}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
          onDelete={handleDelete}
          onLogout={handleLogout}
        />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
