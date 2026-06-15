"use client";

import { useRef, useState } from "react";
import { ArrowUp, Search, X } from "lucide-react";

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

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function activateWebSearch() {
    setValue("@web-search ");
    textareaRef.current?.focus();
  }

  function removeWebSearch() {
    setValue(value.replace(/^@web-search\s*/i, ""));
    textareaRef.current?.focus();
  }

  return (
    <div className="bg-white pb-4 pt-2">
      <div className="mx-auto w-full max-w-2xl px-4">

        {/* Mode tags row */}
        <div className="mb-1.5 flex items-center gap-2">
          {isWebSearch ? (
            <span className="flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[0.75rem] font-medium text-indigo-600">
              <Search className="h-3 w-3" strokeWidth={2.5} />
              Web Search
              <button
                onClick={removeWebSearch}
                aria-label="Remove web search"
                className="ml-0.5 rounded-full text-indigo-400 hover:text-indigo-700"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={activateWebSearch}
              disabled={disabled}
              className="flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-0.5 text-[0.75rem] font-medium text-zinc-400 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"
            >
              <Search className="h-3 w-3" strokeWidth={2} />
              Web Search
            </button>
          )}
        </div>

        {/* Input box */}
        <div
          className={`flex items-center gap-2 rounded-2xl border px-4 py-3 shadow-sm transition-all ${
            disabled
              ? "border-zinc-200 bg-zinc-50"
              : isWebSearch
              ? "border-indigo-300 bg-white ring-2 ring-indigo-100"
              : "border-zinc-200 bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100"
          }`}
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
            placeholder={disabled ? "Thinking…" : isWebSearch ? "Search the web…" : "Message Xenon AI"}
            className="flex-1 resize-none bg-transparent text-[0.875rem] text-zinc-900 placeholder-zinc-400 outline-none disabled:cursor-not-allowed"
          />
          <button
            onClick={submit}
            disabled={disabled || !value.trim()}
            aria-label="Send"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
