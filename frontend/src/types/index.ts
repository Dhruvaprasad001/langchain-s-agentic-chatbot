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

export interface ThinkingStep {
  label: string;
  status: "start" | "done";
}

export interface Message {
  messageId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  /** Plan steps emitted by the planner node (analytical path only). */
  planSteps?: string[];
  /** Live executor progress shown inside a thinking block. */
  thinkingSteps?: ThinkingStep[];
}
