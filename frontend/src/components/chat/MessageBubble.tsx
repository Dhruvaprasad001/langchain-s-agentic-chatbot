"use client";

import { useState } from "react";
import { Check, Copy, Globe, Sparkles } from "lucide-react";
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
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 transition-all hover:bg-white/8 hover:text-zinc-300"
    >
      {copied ? (
        <><Check className="h-3 w-3 text-emerald-400" strokeWidth={2.5} /><span className="text-emerald-400">Copied</span></>
      ) : (
        <><Copy className="h-3 w-3" strokeWidth={1.75} /><span>Copy</span></>
      )}
    </button>
  );
}

function Caret() {
  return (
    <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-px animate-[blink_1s_step-end_infinite] rounded-sm bg-current align-middle opacity-70" />
  );
}

const markdownComponents = {
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-3 overflow-x-auto rounded-xl bg-zinc-950 p-4 ring-1 ring-white/8">
      {children}
    </pre>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const isInline = !className && !String(children).includes("\n");
    if (isInline) {
      return (
        <code className="rounded-md bg-white/8 px-1.5 py-0.5 font-mono text-xs text-indigo-300">
          {children}
        </code>
      );
    }
    return (
      <code className="font-mono text-xs leading-relaxed text-zinc-300 whitespace-pre">
        {String(children).replace(/\n$/, "")}
      </code>
    );
  },
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-1.5 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-zinc-300">{children}</li>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-2 mt-4 text-lg font-semibold text-zinc-100">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-2 mt-3 text-base font-semibold text-zinc-100">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-1.5 mt-2.5 text-sm font-semibold text-zinc-200">{children}</h3>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2 border-l-2 border-indigo-500/50 pl-3 text-zinc-400 italic">{children}</blockquote>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline-offset-2 hover:text-indigo-300 hover:underline">{children}</a>
  ),
};

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isWebSearch = isUser && message.content.trim().startsWith("@web-search");
  const displayContent = isWebSearch
    ? message.content.replace(/^@web-search\s*/i, "").trim()
    : message.content;
  const isMarkdown = !isUser && hasMarkdown(message.content);
  const hasThinking =
    !isUser &&
    ((message.planSteps?.length ?? 0) > 0 || (message.thinkingSteps?.length ?? 0) > 0);

  return (
    <div className={`flex w-full flex-col gap-2 animate-fade-in ${isUser ? "items-end" : "items-start"}`}>

      {/* ── Thinking block ─────────────────────────────────────────────────── */}
      {hasThinking && (
        <div className="w-full overflow-hidden rounded-2xl ring-1 ring-white/8" style={{ background: "rgba(99,102,241,0.06)" }}>
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(99,102,241,0.12)" }}>
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" strokeWidth={2} />
            <span className="text-xs font-semibold text-indigo-400">Thinking</span>
            {isStreaming && (
              <span className="ml-auto flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
            )}
          </div>
          <div className="space-y-4 px-4 py-3">
            {(message.planSteps ?? []).length > 0 && (
              <div>
                <p className="mb-2 text-2xs font-bold uppercase tracking-widest text-indigo-500/70">Plan</p>
                <ol className="space-y-2">
                  {(message.planSteps ?? []).map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs text-zinc-400">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-2xs font-bold text-indigo-400">
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
                <p className="mb-2 text-2xs font-bold uppercase tracking-widest text-indigo-500/70">Executing</p>
                <ul className="space-y-1.5">
                  {(message.thinkingSteps ?? []).map((s, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-xs text-zinc-400">
                      {s.status === "done" ? (
                        <Check className="h-3 w-3 shrink-0 text-emerald-400" strokeWidth={2.5} />
                      ) : (
                        <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-indigo-900 border-t-indigo-400" />
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
          <div className="w-full overflow-hidden rounded-2xl ring-1 ring-white/8" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                  <Sparkles className="h-2.5 w-2.5 text-white" strokeWidth={2} />
                </div>
                <span className="text-xs font-medium text-zinc-500">Xenon AI</span>
              </div>
              <CopyButton text={message.content} />
            </div>
            <div className="px-4 py-3.5 text-sm leading-relaxed text-zinc-300">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
              {isStreaming && <Caret />}
            </div>
          </div>
        ) : (
          <div
            className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              isUser
                ? "rounded-br-sm bg-indigo-600 text-white shadow-lg shadow-indigo-950/50"
                : "rounded-bl-sm text-zinc-300 ring-1 ring-white/8"
            }`}
            style={isUser ? {} : { background: "rgba(255,255,255,0.05)" }}
          >
            {isWebSearch && (
              <span className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-widest text-indigo-300/80">
                <Globe className="h-3 w-3" strokeWidth={2.5} />
                Web search
              </span>
            )}
            {!isUser && (
              <div className="mb-2 flex items-center gap-2">
                <div className="h-4 w-4 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                  <Sparkles className="h-2 w-2 text-white" strokeWidth={2} />
                </div>
                <span className="text-xs font-medium text-zinc-600">Xenon AI</span>
              </div>
            )}
            <span className="whitespace-pre-wrap">{displayContent}</span>
            {isStreaming && <Caret />}
          </div>
        )
      )}
    </div>
  );
}
