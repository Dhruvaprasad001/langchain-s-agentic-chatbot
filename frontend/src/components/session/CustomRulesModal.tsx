"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X, Save } from "lucide-react";
import { getCustomRules, saveCustomRules } from "@/src/services/customRulesService";
import { Spinner } from "@/src/components/ui/Spinner";

interface CustomRulesModalProps {
  open: boolean;
  onClose: () => void;
}

export function CustomRulesModal({ open, onClose }: CustomRulesModalProps) {
  const [rules, setRules] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getCustomRules();
      setRules(data ?? "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setSaved(false);
      load();
    }
  }, [open]);

  useEffect(() => {
    if (!loading && open) {
      textareaRef.current?.focus();
    }
  }, [loading, open]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveCustomRules(rules);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
  }

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
          background: "rgba(14,14,18,0.97)",
          borderColor: "var(--sidebar-border)",
          maxHeight: "75vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600/20 ring-1 ring-violet-500/30">
              <SlidersHorizontal className="h-3.5 w-3.5 text-violet-400" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[1rem] font-semibold text-zinc-100">Custom Rules</p>
              <p className="text-[0.8rem] text-zinc-500">Tailor how Xenon AI responds to you</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition-all hover:bg-white/5 hover:text-zinc-300"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Description */}
        <div className="shrink-0 px-5 pt-4 pb-2">
          <p className="text-[0.8rem] leading-relaxed text-zinc-500">
            Write instructions that will be included at the start of every AI call — things like your
            preferred tone, response style, topics to avoid, or any context that helps the AI serve
            you better.
          </p>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col overflow-hidden px-5 pb-4">
          {loading ? (
            <div className="flex flex-1 items-center justify-center py-10">
              <Spinner size="sm" />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={rules}
              onChange={(e) => { setRules(e.target.value); setSaved(false); }}
              onKeyDown={handleKeyDown}
              placeholder={
                "e.g. Always respond concisely. Prefer bullet points over paragraphs. " +
                "Don't use filler phrases like \"Certainly!\" or \"Great question!\"."
              }
              className="mt-1 flex-1 resize-none rounded-xl border bg-transparent px-3.5 py-3 text-sm text-zinc-200
                         placeholder-zinc-600 outline-none transition-colors
                         focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
              style={{
                borderColor: "var(--sidebar-border)",
                minHeight: "160px",
              }}
            />
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div
            className="flex shrink-0 items-center justify-between px-5 py-3"
            style={{ borderTop: "1px solid var(--sidebar-border)" }}
          >
            <p className="text-xs text-zinc-600">
              {rules.length > 0 ? `${rules.length} character${rules.length !== 1 ? "s" : ""}` : "No rules set"}
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all
                disabled:opacity-50
                ${saved
                  ? "bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/30"
                  : "bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/30 hover:bg-violet-600/30 hover:text-violet-300"
                }`}
            >
              {saving ? (
                <Spinner size="sm" />
              ) : (
                <Save className="h-3 w-3" strokeWidth={2} />
              )}
              {saved ? "Saved!" : "Save rules"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
