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

/** Detect whether a string contains markdown constructs worth rendering. */
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
      title="Copy to clipboard"
      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />
          <span className="text-emerald-500">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Copy</span>
        </>
      )}
    </button>
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

      {/* ── Thinking block (analytical path only) ──────────────────────────── */}
      {hasThinking && (
        <div className="w-full max-w-[85%] rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900">
          <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Thinking
            </span>
            {isStreaming && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            )}
          </div>

          <div className="space-y-1.5 px-3 py-2">
            {(message.planSteps ?? []).length > 0 && (
              <div className="mb-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                  Plan
                </p>
                <ol className="space-y-1 pl-1">
                  {(message.planSteps ?? []).map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-bold dark:bg-neutral-700">
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
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                  Executing
                </p>
                <ul className="space-y-1 pl-1">
                  {(message.thinkingSteps ?? []).map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                      {s.status === "done" ? (
                        <Check className="h-3 w-3 text-emerald-500" strokeWidth={2.5} />
                      ) : (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-amber-400" />
                      )}
                      <span className={s.status === "done" ? "line-through opacity-60" : ""}>
                        {s.label}
                      </span>
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
          /* Bordered block stands alone — no outer bubble */
          <div className="w-full max-w-[85%] rounded-xl border border-neutral-200 bg-white dark:border-neutral-600 dark:bg-neutral-900">
            {/* copy button pinned top-right */}
            <div className="flex justify-end border-b border-neutral-200 px-2 py-1 dark:border-neutral-600">
              <CopyButton text={message.content} />
            </div>
            {/* rendered markdown */}
            <div className="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100 prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-code:rounded prose-code:bg-neutral-100 prose-code:px-1 prose-code:py-0.5 dark:prose-code:bg-neutral-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="ml-0.5 inline-block w-px animate-pulse bg-neutral-900 align-middle text-base leading-none dark:bg-neutral-100">
                  &nbsp;|
                </span>
              )}
            </div>
          </div>
        ) : (
          /* Plain bubble — user messages and short plain-text assistant replies */
          <div
            className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed wrap-break-word ${
              isUser
                ? "rounded-br-sm bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "rounded-bl-sm bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            }`}
          >
            <span className="whitespace-pre-wrap">{message.content}</span>
            {isStreaming && (
              <span className="ml-0.5 inline-block w-px animate-pulse bg-current align-middle text-base leading-none">
                &nbsp;|
              </span>
            )}
          </div>
        )
      )}
    </div>
  );
}
