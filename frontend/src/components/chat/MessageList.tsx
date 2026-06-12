import type { Message } from "@/src/types";
import { MessageBubble } from "@/src/components/chat/MessageBubble";

interface MessageListProps {
  messages: Message[];
  streaming?: boolean;
}

export function MessageList({ messages, streaming = false }: MessageListProps) {
  // TODO: render list of MessageBubble, auto-scroll to bottom, show typing indicator when streaming
  return (
    <div>
      {messages.map((m) => (
        <MessageBubble key={m.messageId} message={m} />
      ))}
    </div>
  );
}
