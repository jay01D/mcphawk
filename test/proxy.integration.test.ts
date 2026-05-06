import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseArgs } from "../src/cli.js";

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mcptrace-int-"));
  dbPath = join(dir, "observe.db");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("parseArgs", () => {
  it("returns defaults when given an empty argv", () => {
    const a = parseArgs([]);
    expect(a.port).toBe(4800);
    expect(a.dbPath).toBe("./observe.db");
    expect(a.dashboard).toBe(true);
    expect(a.command).toBeNull();
  });

  it("splits options from the wrapped command at --", () => {
    const a = parseArgs([
      "--port",
      "5001",
      "--",
      "node",
      "server.js",
      "--flag",
    ]);
    expect(a.port).toBe(5001);
    expect(a.command).toBe("node");
    expect(a.commandArgs).toEqual(["server.js", "--flag"]);
  });

  it("turns --no-dashboard off and respects --quiet", () => {
    const a = parseArgs(["--no-dashboard", "--quiet", "--", "echo"]);
    expect(a.dashboard).toBe(false);
    expect(a.quiet).toBe(true);
  });

  it("throws on an unknown option", () => {
    expect(() => parseArgs(["--what"])).toThrowError(/unknown option/);
  });

  it("throws when --port has no value", () => {
    expect(() => parseArgs(["--port"])).toThrow();
  });
});

describe("cli end to end", () => {
  it("logs a tools/list round trip into sqlite", async () => {
    const cliPath = new URL("../src/cli.ts", import.meta.url).pathname;
    const fakePath = new URL("./fixtures/fakeMcpServer.ts", import.meta.url)
      .pathname;
    const proc = spawn(
      "npx",
      [
        "tsx",
        cliPath,
        "--no-dashboard",
        "--db",
        dbPath,
        "--quiet",
        "--",
        "npx",
        "tsx",
        fakePath,
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    const responses: string[] = [];
    proc.stdout.on("data", (chunk: Buffer) => {
      responses.push(chunk.toString("utf8"));
    });

    await sleep(700);
    proc.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`,
    );
    await sleep(700);
    proc.stdin.end();

    await new Promise<void>((done) => proc.on("exit", () => done()));

    const text = responses.join("");
    expect(text).toContain("read_file");

    const db = new Database(dbPath, { readonly: true });
    const rows = db
      .prepare("SELECT method, kind, direction FROM messages ORDER BY id ASC")
      .all() as Array<{
      method: string | null;
      kind: string;
      direction: string;
    }>;
    db.close();

    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(
      rows.some(
        (r) => r.method === "tools/list" && r.direction === "client_to_server",
      ),
    ).toBe(true);
    expect(
      rows.some(
        (r) => r.direction === "server_to_client" && r.kind === "response",
      ),
    ).toBe(true);
  }, 20_000);
});
