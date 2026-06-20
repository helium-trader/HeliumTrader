// Client helper for consuming an AI SDK `toUIMessageStreamResponse()` stream.
// The endpoints (/api/reports/backtest, /api/reports/eod) emit a Server-Sent
// Events body of UI message chunks. We only care about the text deltas, which
// we surface incrementally so the UI can render the report as it streams.

export async function streamReport(
  url: string,
  body: unknown,
  onDelta: (full: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const msg = (await res.text().catch(() => "")) || "Failed to generate report.";
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return full;
      let chunk: { type?: string; delta?: unknown; errorText?: unknown };
      try {
        chunk = JSON.parse(data);
      } catch {
        continue; // non-JSON keep-alive line
      }
      if (chunk.type === "text-delta" && typeof chunk.delta === "string") {
        full += chunk.delta;
        onDelta(full);
      } else if (chunk.type === "error") {
        // The AI SDK encodes mid-stream failures (e.g. provider/gateway
        // errors) as an `error` chunk over an otherwise-200 response.
        throw new Error(
          typeof chunk.errorText === "string" && chunk.errorText
            ? chunk.errorText
            : "The AI provider could not generate this report."
        );
      }
    }
  }

  if (!full.trim()) {
    throw new Error("No report content was generated. Please try again.");
  }

  return full;
}
