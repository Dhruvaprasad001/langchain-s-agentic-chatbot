import type { Message } from "@/src/types";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  // TODO: render user vs assistant bubble with distinct alignment and colors
  return (
    <div>
      <span>{message.role}</span>
      <p>{message.content}</p>
    </div>
  );
}
