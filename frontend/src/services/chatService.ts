const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export function streamMessage(
  token: string,
  sessionId: string,
  message: string,
  onChunk: (delta: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): void {
  fetch(`${BACKEND_URL}/api/v1/chat/${sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message }),
  })
    .then((res) => {
      if (!res.ok) throw new Error(`Chat request failed: ${res.statusText}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      function pump(): Promise<void> {
        return reader.read().then(({ done, value }) => {
          if (done) {
            onDone();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last (potentially incomplete) line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const raw = trimmed.slice("data:".length).trim();
            if (raw === "[DONE]") {
              onDone();
              return;
            }
            try {
              const parsed = JSON.parse(raw) as { content?: string };
              if (parsed.content) onChunk(parsed.content);
            } catch {
              // skip malformed lines
            }
          }

          return pump();
        });
      }

      return pump();
    })
    .catch(onError);
}
