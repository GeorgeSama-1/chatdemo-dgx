import { parseNdjsonChunk } from "./streaming";

describe("streaming", () => {
  it("parses multiple NDJSON events from a chunk", () => {
    const events = parseNdjsonChunk(
      '{"type":"delta","delta":"Hello"}\n{"type":"done"}\n'
    );

    expect(events).toEqual([
      { type: "delta", delta: "Hello" },
      { type: "done" },
    ]);
  });

  it("ignores blank lines", () => {
    const events = parseNdjsonChunk('\n{"type":"done"}\n\n');

    expect(events).toEqual([{ type: "done" }]);
  });
});
