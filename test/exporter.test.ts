import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportRows } from "../src/exporter.js";
import type { Frame } from "../src/framing.js";
import { Logger } from "../src/logger.js";

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mcphawk-exp-"));
  dbPath = join(dir, "observe.db");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function frameMsg(obj: object): Frame {
  return { kind: "msg", raw: JSON.stringify(obj), msg: obj as never };
}

function seed() {
  const log = new Logger({ dbPath, sessionId: "s1" });
  log.record(
    "client_to_server",
    frameMsg({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  );
  log.record(
    "server_to_client",
    frameMsg({ jsonrpc: "2.0", id: 1, result: { tools: [] } }),
  );
  log.record(
    "client_to_server",
    frameMsg({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "x" },
    }),
  );
  log.record(
    "server_to_client",
    frameMsg({ jsonrpc: "2.0", id: 2, error: { code: -1, message: "no" } }),
  );
  log.close();
}

describe("exportRows", () => {
  it("dumps rows as a JSON array", () => {
    seed();
    const out = JSON.parse(exportRows({ dbPath, format: "json" })) as Array<{
      method: string | null;
    }>;
    expect(out).toHaveLength(4);
    expect(out[0]?.method).toBe("tools/list");
  });

  it("produces an OTLP-shaped payload with one span per request", () => {
    seed();
    const out = JSON.parse(exportRows({ dbPath, format: "otel" })) as {
      resourceSpans: Array<{
        scopeSpans: Array<{
          spans: Array<{ name: string; status: { code: number } }>;
        }>;
      }>;
    };
    const spans = out.resourceSpans[0]?.scopeSpans[0]?.spans ?? [];
    expect(spans).toHaveLength(2);
    expect(spans.map((s) => s.name).sort()).toEqual([
      "tools/call",
      "tools/list",
    ]);
    const callSpan = spans.find((s) => s.name === "tools/call");
    expect(callSpan?.status.code).toBe(2);
  });

  it("scopes export to a single session id", () => {
    seed();
    const log = new Logger({ dbPath, sessionId: "other" });
    log.record(
      "client_to_server",
      frameMsg({ jsonrpc: "2.0", id: 99, method: "ping" }),
    );
    log.close();
    const out = JSON.parse(
      exportRows({ dbPath, format: "json", sessionId: "s1" }),
    ) as unknown[];
    expect(out).toHaveLength(4);
  });
});
