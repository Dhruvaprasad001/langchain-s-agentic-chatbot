"use client";

import { useRef, useState } from "react";

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
    // Auto-grow textarea
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  return (
    <div className="border-t border-neutral-200 bg-[var(--background)] px-4 py-3 dark:border-neutral-800">
      <div
        className={`flex items-end gap-2 rounded-xl border px-3 py-2 transition-colors ${
          disabled
            ? "border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"
            : "border-neutral-300 bg-white focus-within:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus-within:border-neutral-500"
        }`}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? "Waiting for response…" : "Message (Enter to send, Shift+Enter for newline)"}
          className="flex-1 resize-none bg-transparent text-sm text-neutral-900 placeholder-neutral-400 outline-none disabled:cursor-not-allowed dark:text-neutral-100"
        />
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="Send"
          className="mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white transition hover:bg-neutral-700 disabled:opacity-30 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M3.105 2.288a.75.75 0 00-.826.95l1.903 6.115a.75.75 0 00.713.527h5.355a.75.75 0 010 1.5H4.895a.75.75 0 00-.713.527L2.28 17.962a.75.75 0 00.826.95 28.9 28.9 0 0015.898-8.293.75.75 0 000-1.253A28.9 28.9 0 003.105 2.288z" />
          </svg>
        </button>
      </div>
      <p className="mt-1.5 text-center text-xs text-neutral-400">
        Shift+Enter for newline · Enter to send
      </p>
    </div>
  );
}
