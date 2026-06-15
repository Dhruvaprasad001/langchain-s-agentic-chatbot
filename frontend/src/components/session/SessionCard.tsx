import type { Session } from "@/src/types";
import { formatSessionDate } from "@/src/lib/formatDate";

interface SessionCardProps {
  session: Session;
  active?: boolean;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

export function SessionCard({ session, active = false, onSelect, onDelete }: SessionCardProps) {
  return (
    <div
      className={`group flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors cursor-pointer ${
        active
          ? "bg-neutral-200"
          : "hover:bg-neutral-100"
      }`}
      onClick={() => onSelect(session.sessionId)}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900">
          {session.title}
        </p>
        <p className="truncate text-xs text-neutral-400">
          {formatSessionDate(session.updatedAt)}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(session.sessionId);
        }}
        className="ml-2 hidden rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-red-500 group-hover:flex"
        aria-label="Delete session"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
