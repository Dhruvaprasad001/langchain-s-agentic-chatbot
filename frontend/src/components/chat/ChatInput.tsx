"use client";

import { useRef, useState } from "react";
import { ArrowUp, Globe, X } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isWebSearch = value.trim().startsWith("@web-search");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function activateWebSearch() {
    setValue("@web-search ");
    textareaRef.current?.focus();
  }

  function removeWebSearch() {
    setValue(value.replace(/^@web-search\s*/i, ""));
    textareaRef.current?.focus();
  }

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="px-4 pb-5 pt-2">
      <div className="mx-auto w-full max-w-2xl">
        {/* Mode tags row */}
        <div className="mb-2 flex items-center gap-2 px-1">
          {isWebSearch ? (
            <span className="flex items-center gap-1.5 rounded-full bg-indigo-600/20 px-2.5 py-0.5 text-xs font-medium text-indigo-400 ring-1 ring-indigo-500/30">
              <Globe className="h-3 w-3" strokeWidth={2} />
              Web Search
              <button
                onClick={removeWebSearch}
                className="ml-0.5 rounded-full text-indigo-500 hover:text-indigo-300"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={activateWebSearch}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-white/8 transition-all hover:bg-white/5 hover:text-zinc-300 disabled:opacity-40"
            >
              <Globe className="h-3 w-3" strokeWidth={2} />
              Web Search
            </button>
          )}
        </div>

        {/* Input box */}
        <div
          className={`relative flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200 ${
            disabled
              ? "opacity-60"
              : isWebSearch
              ? "ring-1 ring-indigo-500/40"
              : "ring-1 ring-white/8 focus-within:ring-indigo-500/40"
          }`}
          style={{ background: "rgba(24,24,27,0.9)", backdropFilter: "blur(12px)" }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={isWebSearch ? value.replace(/^@web-search\s*/i, "") : value}
            onChange={(e) => {
              const raw = e.target.value;
              setValue(isWebSearch ? "@web-search " + raw : raw);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={disabled ? "Thinking…" : isWebSearch ? "Search the web…" : "Message Xenon AI…"}
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-zinc-100 placeholder-zinc-600 outline-none disabled:cursor-not-allowed"
          />
          <button
            onClick={submit}
            disabled={!canSend}
            aria-label="Send"
            className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-150 ${
              canSend
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 hover:bg-indigo-500"
                : "bg-white/5 text-zinc-600 cursor-not-allowed"
            }`}
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        <p className="mt-2 text-center text-xs text-zinc-700">
          Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
