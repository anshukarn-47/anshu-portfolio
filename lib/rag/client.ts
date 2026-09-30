import type { ChatEvent } from "./protocol";

/**
 * Posts to /api/chat and calls onEvent for each NDJSON event as it streams in.
 * Resolves when the stream ends; throws on an HTTP error (with the server's
 * message when it sent one), a network error, or an "error" event.
 */
export async function streamChat(body: unknown, onEvent: (e: ChatEvent) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const err = (await res.json().catch(() => null)) as ChatEvent | null;
    throw new Error(err?.type === "error" ? err.message : `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as ChatEvent;
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "done") done = true;
      onEvent(event);
    }
  }
  // A stream cut off before "done" means the answer didn't complete.
  if (!done) throw new Error("Stream ended early");
}
