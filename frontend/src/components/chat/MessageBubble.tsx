import type { Message } from "@/src/types";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? "rounded-br-sm bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
            : "rounded-bl-sm bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
        }`}
      >
        {message.content}
        {isStreaming && (
          <span className="ml-0.5 inline-block w-px animate-pulse bg-current align-middle text-base leading-none">
            &nbsp;|
          </span>
        )}
      </div>
    </div>
  );
}
