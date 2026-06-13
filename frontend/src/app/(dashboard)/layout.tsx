"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { SessionSidebar } from "@/src/components/session/SessionSidebar";
import { useSessions } from "@/src/hooks/useSessions";

// ── Sidebar context — lets child pages toggle and query sidebar state ─────────

interface SidebarContextValue {
  open: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  open: true,
  toggle: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const { sessions, loading, createSession, deleteSession } = useSessions();

  const toggle = useCallback(() => setOpen((v) => !v), []);

  async function handleNewChat() {
    const session = await createSession("New conversation");
    router.push(`/session/${session.sessionId}`);
  }

  async function handleDelete(sessionId: string) {
    await deleteSession(sessionId);
    // if we just deleted the active session, go back to home
    if (typeof window !== "undefined" && window.location.pathname.includes(sessionId)) {
      router.push("/");
    }
  }

  return (
    <SidebarContext.Provider value={{ open, toggle }}>
      <div className="flex h-screen overflow-hidden bg-white">
        <SessionSidebar
          sessions={sessions}
          loading={loading}
          open={open}
          onClose={() => setOpen(false)}
          onNewChat={handleNewChat}
          onDelete={handleDelete}
        />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
