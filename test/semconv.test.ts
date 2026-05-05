import { describe, expect, it } from "vitest";
import type { Frame } from "../src/framing.js";
import { classify } from "../src/semconv.js";

function msgFrame(msg: object): Frame {
  return {
    kind: "msg",
    raw: JSON.stringify(msg),
    msg: msg as Frame extends { msg: infer M } ? M : never,
  };
}

describe("classify", () => {
  it("tags a request with method + id", () => {
    const c = classify(
      msgFrame({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    );
    expect(c.kind).toBe("request");
    expect(c.method).toBe("tools/list");
    expect(c.jsonrpcId).toBe("1");
    expect(c.isError).toBe(false);
  });

  it("tags a notification when id is missing", () => {
    const c = classify(
      msgFrame({ jsonrpc: "2.0", method: "notifications/cancelled" }),
    );
    expect(c.kind).toBe("notification");
    expect(c.jsonrpcId).toBeNull();
  });

  it("tags a successful response", () => {
    const c = classify(
      msgFrame({ jsonrpc: "2.0", id: 2, result: { ok: true } }),
    );
    expect(c.kind).toBe("response");
    expect(c.isError).toBe(false);
    expect(c.jsonrpcId).toBe("2");
  });

  it("tags an error response with code and message", () => {
    const c = classify(
      msgFrame({
        jsonrpc: "2.0",
        id: 3,
        error: { code: -32601, message: "Method not found" },
      }),
    );
    expect(c.kind).toBe("response");
    expect(c.isError).toBe(true);
    expect(c.errorCode).toBe(-32601);
    expect(c.errorMessage).toBe("Method not found");
  });

  it("extracts tool name from tools/call params", () => {
    const c = classify(
      msgFrame({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "read_file", arguments: { path: "/tmp/x" } },
      }),
    );
    expect(c.toolName).toBe("read_file");
  });

  it("does not set tool name on other methods", () => {
    const c = classify(
      msgFrame({ jsonrpc: "2.0", id: 5, method: "tools/list" }),
    );
    expect(c.toolName).toBeNull();
  });

  it("treats a bad frame as kind=bad with the parse error", () => {
    const c = classify({
      kind: "bad",
      raw: "garbage",
      error: "Unexpected token",
    });
    expect(c.kind).toBe("bad");
    expect(c.isError).toBe(true);
    expect(c.errorMessage).toBe("Unexpected token");
  });

  it("stringifies numeric and string ids consistently", () => {
    expect(
      classify(msgFrame({ jsonrpc: "2.0", id: 0, method: "ping" })).jsonrpcId,
    ).toBe("0");
    expect(
      classify(msgFrame({ jsonrpc: "2.0", id: "abc", method: "ping" }))
        .jsonrpcId,
    ).toBe("abc");
  });
});
