"use client";

import { useState } from "react";
import type { Message } from "@/src/types";

interface UseChatReturn {
  messages: Message[];
  streaming: boolean;
  error: string | null;
  sendMessage: (content: string, model?: string) => Promise<void>;
  loadHistory: (sessionId: string) => Promise<void>;
}

export function useChat(sessionId: string): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadHistory(sid: string): Promise<void> {
    // TODO: get token, call getSession(token, sid), setMessages from response
    throw new Error("Not implemented");
  }

  async function sendMessage(content: string, model = "anthropic/claude-sonnet-4-6"): Promise<void> {
    // TODO: optimistically append user message, get token,
    // call streamChat(token, sessionId, content, model, onDelta, onDone),
    // build assistant message incrementally from deltas
    throw new Error("Not implemented");
  }

  return { messages, streaming, error, sendMessage, loadHistory };
}
