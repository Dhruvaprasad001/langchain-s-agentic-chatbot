interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  // TODO: controlled textarea with send button; submit on Enter (Shift+Enter for newline)
  return (
    <div>
      <textarea disabled={disabled} />
      <button disabled={disabled} onClick={() => onSend("")}>Send</button>
    </div>
  );
}
