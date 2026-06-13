export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface Session {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  messageId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
