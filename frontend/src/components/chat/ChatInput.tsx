"use client";

import { useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <div className="bg-white pb-4 pt-2">
      {/* same 50%-wide centred column as MessageList */}
      <div className="mx-auto w-full max-w-2xl px-4">
        <div
          className={`flex items-center gap-2 rounded-2xl border px-4 py-3 shadow-sm transition-all ${
            disabled
              ? "border-zinc-200 bg-zinc-50"
              : "border-zinc-200 bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100"
          }`}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={disabled ? "Thinking…" : "Message Xenon"}
            className="flex-1 resize-none bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none disabled:cursor-not-allowed"
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
