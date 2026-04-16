import type { StreamEvent } from "./types";

export function parseNdjsonChunk(chunk: string): StreamEvent[] {
  return chunk
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as StreamEvent);
}

export function splitNdjsonBuffer(buffer: string): {
  events: StreamEvent[];
  remainder: string;
} {
  const lines = buffer.split("\n");
  const remainder = lines.pop() ?? "";
  const events = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as StreamEvent);

  return { events, remainder };
}
