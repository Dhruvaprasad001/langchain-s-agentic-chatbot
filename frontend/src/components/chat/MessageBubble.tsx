"use client";

import { useState } from "react";
import { Check, Copy, Search } from "lucide-react";
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
      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
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
  const isWebSearch = isUser && message.content.trim().startsWith("@web-search");
  // strip the prefix for display in the user bubble
  const displayContent = isWebSearch
    ? message.content.replace(/^@web-search\s*/i, "").trim()
    : message.content;
  const isMarkdown = !isUser && hasMarkdown(message.content);
  const hasThinking =
    !isUser &&
    ((message.planSteps?.length ?? 0) > 0 || (message.thinkingSteps?.length ?? 0) > 0);

  return (
    <div className={`flex w-full flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>

      {/* ── Thinking block ─────────────────────────────────────────────────── */}
      {hasThinking && (
        <div className="w-full rounded-xl border border-indigo-100 bg-indigo-50/60">
          <div className="flex items-center gap-2 border-b border-indigo-100 px-3 py-2">
            <span className="text-xs font-semibold text-indigo-500">Thinking</span>
            {isStreaming && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />}
          </div>
          <div className="space-y-3 px-3 py-2.5">
            {(message.planSteps ?? []).length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-400">Plan</p>
                <ol className="space-y-1.5">
                  {(message.planSteps ?? []).map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-zinc-700">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">
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
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-400">Executing</p>
                <ul className="space-y-1.5">
                  {(message.thinkingSteps ?? []).map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-zinc-700">
                      {s.status === "done" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />
                      ) : (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-400" />
                      )}
                      <span className={s.status === "done" ? "opacity-40 line-through" : ""}>{s.label}</span>
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
          <div className="w-full rounded-xl border border-zinc-200 bg-white">
            <div className="flex justify-end border-b border-zinc-200 px-2 py-1">
              <CopyButton text={message.content} />
            </div>
            <div className="px-4 py-3 text-sm text-zinc-800 prose prose-sm max-w-none prose-p:my-1.5 prose-pre:my-2 prose-ul:my-1.5 prose-ol:my-1.5 prose-headings:my-2 prose-code:rounded-md prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              {isStreaming && <Caret />}
            </div>
          </div>
        ) : (
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed wrap-break-word ${
              isUser
                ? "rounded-br-sm bg-indigo-600 text-white"
                : "rounded-bl-sm bg-zinc-100 text-zinc-800"
            }`}
          >
            {/* Web search pill */}
            {isWebSearch && (
              <span className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-indigo-200">
                <Search className="h-3 w-3" strokeWidth={2.5} />
                Web search
              </span>
            )}
            <span className="whitespace-pre-wrap">{displayContent}</span>
            {isStreaming && <Caret />}
          </div>
        )
      )}
    </div>
  );
}
