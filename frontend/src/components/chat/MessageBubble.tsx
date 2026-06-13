"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/src/types";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

function hasMarkdown(text: string): boolean {
  return /[#*`_~\[\]|>]/.test(text) || /\n\n/.test(text);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy"
      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
    >
      {copied ? (
        <><Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} /><span className="text-emerald-500">Copied</span></>
      ) : (
        <><Copy className="h-3.5 w-3.5" strokeWidth={1.75} /><span>Copy</span></>
      )}
    </button>
  );
}

/** A blinking block cursor — cleaner than the &nbsp;| hack */
function Caret() {
  return (
    <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-px animate-[blink_1s_step-end_infinite] rounded-sm bg-current align-middle" />
  );
}

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isMarkdown = !isUser && hasMarkdown(message.content);
  const hasThinking =
    !isUser &&
    ((message.planSteps?.length ?? 0) > 0 || (message.thinkingSteps?.length ?? 0) > 0);

  return (
    <div className={`flex w-full flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>

      {/* ── Thinking block ─────────────────────────────────────────────────── */}
      {hasThinking && (
        <div className="w-full rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Thinking</span>
            {isStreaming && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />}
          </div>
          <div className="space-y-2 px-3 py-2.5">
            {(message.planSteps ?? []).length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Plan</p>
                <ol className="space-y-1.5">
                  {(message.planSteps ?? []).map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {(message.thinkingSteps ?? []).length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Executing</p>
                <ul className="space-y-1.5">
                  {(message.thinkingSteps ?? []).map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                      {s.status === "done" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />
                      ) : (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-200 border-t-amber-400" />
                      )}
                      <span className={s.status === "done" ? "line-through opacity-50" : ""}>{s.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Message bubble ──────────────────────────────────────────────────── */}
      {(message.content || isStreaming) && (
        isMarkdown ? (
          <div className="w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex justify-end border-b border-zinc-200 px-2 py-1 dark:border-zinc-700">
              <CopyButton text={message.content} />
            </div>
            <div className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-pre:my-2 prose-ul:my-1.5 prose-ol:my-1.5 prose-headings:my-2 prose-code:rounded-md prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 dark:prose-code:bg-zinc-800">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              {isStreaming && <Caret />}
            </div>
          </div>
        ) : (
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed wrap-break-word ${
              isUser
                ? "rounded-br-sm bg-indigo-600 text-white"
                : "rounded-bl-sm bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
            }`}
          >
            <span className="whitespace-pre-wrap">{message.content}</span>
            {isStreaming && <Caret />}
          </div>
        )
      )}
    </div>
  );
}
