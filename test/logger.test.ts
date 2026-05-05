import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Frame } from "../src/framing.js";
import { Logger, type LogRow } from "../src/logger.js";

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mcptrace-test-"));
  dbPath = join(dir, "observe.db");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function req(id: number, method: string): Frame {
  const msg = { jsonrpc: "2.0" as const, id, method };
  return { kind: "msg", raw: JSON.stringify(msg), msg };
}

function toolCall(id: number, name: string): Frame {
  const msg = {
    jsonrpc: "2.0" as const,
    id,
    method: "tools/call",
    params: { name },
  };
  return { kind: "msg", raw: JSON.stringify(msg), msg };
}

function errResp(id: number, code: number, message: string): Frame {
  const msg = { jsonrpc: "2.0" as const, id, error: { code, message } };
  return { kind: "msg", raw: JSON.stringify(msg), msg };
}

describe("Logger", () => {
  it("creates the schema and inserts a row", () => {
    const log = new Logger({ dbPath, sessionId: "s1" });
    const row = log.record("client_to_server", req(1, "tools/list"));
    expect(row.id).toBeGreaterThan(0);
    expect(row.method).toBe("tools/list");
    log.close();
  });

  it("stores tool name for tools/call", () => {
    const log = new Logger({ dbPath, sessionId: "s1" });
    const row = log.record("client_to_server", toolCall(7, "read_file"));
    expect(row.toolName).toBe("read_file");
    log.close();
  });

  it("marks error responses with code and message", () => {
    const log = new Logger({ dbPath, sessionId: "s1" });
    const row = log.record("server_to_client", errResp(9, -32603, "boom"));
    expect(row.isError).toBe(true);
    expect(row.errorCode).toBe(-32603);
    expect(row.errorMessage).toBe("boom");
    log.close();
  });

  it("emits a row event after insert", () => {
    const log = new Logger({ dbPath, sessionId: "s1" });
    const seen: LogRow[] = [];
    log.on("row", (r: LogRow) => seen.push(r));
    log.record("client_to_server", req(1, "ping"));
    log.record("client_to_server", req(2, "ping"));
    expect(seen).toHaveLength(2);
    expect(seen[0]?.method).toBe("ping");
    log.close();
  });

  it("returns recent rows in chronological order", () => {
    const log = new Logger({ dbPath, sessionId: "s1" });
    log.record("client_to_server", req(1, "a"));
    log.record("client_to_server", req(2, "b"));
    log.record("client_to_server", req(3, "c"));
    const rows = log.recent(10);
    expect(rows.map((r) => r.method)).toEqual(["a", "b", "c"]);
    log.close();
  });

  it("scopes bySession to a single session id", () => {
    const a = new Logger({ dbPath, sessionId: "sA" });
    const b = new Logger({ dbPath, sessionId: "sB" });
    a.record("client_to_server", req(1, "x"));
    b.record("client_to_server", req(2, "y"));
    expect(a.bySession("sA").map((r) => r.method)).toEqual(["x"]);
    expect(a.bySession("sB").map((r) => r.method)).toEqual(["y"]);
    a.close();
    b.close();
  });
});
