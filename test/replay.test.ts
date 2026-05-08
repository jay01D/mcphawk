import { describe, expect, it } from "vitest";
import { diffJson } from "../src/replay/diff.js";
import { runReplay } from "../src/replay/runner.js";

describe("diffJson", () => {
  it("returns same for identical primitives", () => {
    expect(diffJson(1, 1)).toEqual({ kind: "same", value: 1 });
    expect(diffJson("a", "a")).toEqual({ kind: "same", value: "a" });
  });

  it("flags a changed primitive", () => {
    expect(diffJson(1, 2)).toEqual({ kind: "changed", before: 1, after: 2 });
  });

  it("marks added and removed object keys", () => {
    const d = diffJson({ a: 1 }, { a: 1, b: 2 });
    expect(d.kind).toBe("object");
    if (d.kind !== "object") return;
    const b = d.entries.find((e) => e.key === "b");
    expect(b?.diff).toEqual({ kind: "added", value: 2 });
  });

  it("walks nested arrays", () => {
    const d = diffJson([1, 2], [1, 3]);
    expect(d.kind).toBe("array");
    if (d.kind !== "array") return;
    expect(d.items[1]).toEqual({ kind: "changed", before: 2, after: 3 });
  });
});

describe("runReplay", () => {
  const fakePath = new URL("./fixtures/fakeMcpServer.ts", import.meta.url)
    .pathname;

  it("re-sends a tools/list request and gets a fresh response", async () => {
    const out = await runReplay({
      command: "npx",
      args: ["tsx", fakePath],
      request: JSON.stringify({ jsonrpc: "2.0", id: 42, method: "tools/list" }),
    });
    expect(out.timedOut).toBe(false);
    expect(out.raw).toContain("read_file");
  }, 20_000);

  it("times out cleanly when the server never answers", async () => {
    const out = await runReplay({
      command: "node",
      args: ["-e", "setInterval(()=>{},1000)"],
      request: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
      timeoutMs: 400,
    });
    expect(out.timedOut).toBe(true);
    expect(out.raw).toBeNull();
  }, 10_000);
});
