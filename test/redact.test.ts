import { describe, expect, it } from "vitest";
import { Redactor } from "../src/redact.js";
import { inspectRequest } from "../src/risky.js";

describe("Redactor", () => {
  const r = new Redactor();

  it("masks a Bearer token", () => {
    const out = r.apply("Authorization: Bearer ABCDEFGHIJKLMNOP12345");
    expect(out).toContain("Bearer ***redacted***");
    expect(out).not.toContain("ABCDEFGHIJKLMNOP");
  });

  it("masks an openai-style key", () => {
    const out = r.apply("key=sk-abcdef0123456789ABCDEF");
    expect(out).toContain("sk-***redacted***");
  });

  it("masks a password field in JSON", () => {
    const out = r.apply('{"password":"hunter2","ok":true}');
    expect(out).toContain('"password":"***redacted***"');
    expect(out).toContain("ok");
  });

  it("masks an anthropic key", () => {
    const out = r.apply("key=sk-ant-abcdefghijklmnopqrstuvwxyz");
    expect(out).toContain("sk-ant-***redacted***");
  });

  it("leaves untouched text alone", () => {
    const out = r.apply('{"jsonrpc":"2.0","id":1,"method":"tools/list"}');
    expect(out).toBe('{"jsonrpc":"2.0","id":1,"method":"tools/list"}');
  });
});

describe("inspectRequest", () => {
  it("flags a tool named shell_exec", () => {
    const risks = inspectRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "shell_exec", arguments: { cmd: "ls" } },
    });
    expect(risks.some((r) => r.reason === "risky-tool-name")).toBe(true);
  });

  it("flags rm -rf in arguments", () => {
    const risks = inspectRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "run", arguments: { cmd: "rm -rf /" } },
    });
    expect(risks.some((r) => r.reason === "risky-argument")).toBe(true);
  });

  it("returns nothing for a benign tools/call", () => {
    const risks = inspectRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "read_file", arguments: { path: "/etc/hosts" } },
    });
    expect(risks).toEqual([]);
  });

  it("ignores non-tool methods", () => {
    expect(
      inspectRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    ).toEqual([]);
  });
});
