import type { Session } from "@/src/types";
import { SessionCard } from "@/src/components/session/SessionCard";

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId?: string;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onNewSession: () => void;
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
  onNewSession,
}: SessionSidebarProps) {
  // TODO: render sidebar with "New Chat" button and list of SessionCard components
  return (
    <aside>
      <button onClick={onNewSession}>New Chat</button>
      {sessions.map((s) => (
        <SessionCard
          key={s.sessionId}
          session={s}
          active={s.sessionId === activeSessionId}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ))}
    </aside>
  );
}
