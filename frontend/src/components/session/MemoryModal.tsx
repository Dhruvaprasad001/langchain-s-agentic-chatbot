"use client";

import { useEffect, useState } from "react";
import { Brain, X, RefreshCw } from "lucide-react";
import { listMemory, type MemoryFact } from "@/src/services/memoryService";
import { Spinner } from "@/src/components/ui/Spinner";
import { timeAgo } from "@/src/lib/formatDate";

interface MemoryModalProps {
  open: boolean;
  onClose: () => void;
}

export function MemoryModal({ open, onClose }: MemoryModalProps) {
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await listMemory();
      setFacts(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-md flex-col rounded-2xl border shadow-2xl"
        style={{
          background: "rgba(14,14,18,0.95)",
          borderColor: "var(--sidebar-border)",
          maxHeight: "70vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/20 ring-1 ring-indigo-500/30">
              <Brain className="h-3.5 w-3.5 text-indigo-400" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">Memory</p>
              <p className="text-xs text-zinc-500">What Xenon AI remembers about you</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={load}
              disabled={loading}
              title="Refresh"
              className="rounded-lg p-1.5 text-zinc-500 transition-all hover:bg-white/5 hover:text-zinc-300 disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-500 transition-all hover:bg-white/5 hover:text-zinc-300"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex justify-center py-10">
              <Spinner size="sm" />
            </div>
          )}

          {!loading && facts.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                <Brain className="h-5 w-5 text-zinc-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-400">No memories yet</p>
                <p className="mt-1 text-xs text-zinc-600">
                  Xenon AI will remember things about you as you chat.
                </p>
              </div>
            </div>
          )}

          {!loading && facts.length > 0 && (
            <ul className="space-y-2">
              {facts.map((f, i) => (
                <li
                  key={f.id ?? i}
                  className="flex items-start gap-3 rounded-xl px-3.5 py-3 ring-1 ring-white/5"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-zinc-300">{f.content}</p>
                    {f.timestamp && (
                      <p className="mt-1 text-xs text-zinc-600">{timeAgo(f.timestamp)}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {!loading && facts.length > 0 && (
          <div
            className="shrink-0 px-5 py-3 text-center"
            style={{ borderTop: "1px solid var(--sidebar-border)" }}
          >
            <p className="text-xs text-zinc-600">{facts.length} fact{facts.length !== 1 ? "s" : ""} stored</p>
          </div>
        )}
      </div>
    </div>
  );
}
