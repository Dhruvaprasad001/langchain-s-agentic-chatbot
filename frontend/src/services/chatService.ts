const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

/**
 * Opens an SSE stream to POST /api/v1/chat/{sessionId}.
 * Calls onDelta with each text chunk and onDone when the stream ends.
 */
export async function streamChat(
  token: string,
  sessionId: string,
  message: string,
  model: string,
  onDelta: (delta: string) => void,
  onDone: () => void,
): Promise<void> {
  // TODO: fetch with POST, read response.body as a ReadableStream,
  // parse SSE lines, call onDelta for each data chunk, call onDone on [DONE]
  throw new Error("Not implemented");
}
