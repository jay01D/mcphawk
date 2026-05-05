import { EventEmitter } from "node:events";
import Database, { type Database as DB, type Statement } from "better-sqlite3";
import type { Frame } from "./framing.js";
import type { Direction } from "./proxy.js";
import { classify } from "./semconv.js";

export type LogRow = {
  id: number;
  ts: number;
  sessionId: string;
  direction: Direction;
  kind: "request" | "response" | "notification" | "bad";
  jsonrpcId: string | null;
  method: string | null;
  toolName: string | null;
  isError: boolean;
  errorCode: number | null;
  errorMessage: string | null;
  raw: string;
};

export type LoggerOptions = {
  dbPath: string;
  sessionId: string;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  kind TEXT NOT NULL,
  jsonrpc_id TEXT,
  method TEXT,
  tool_name TEXT,
  is_error INTEGER NOT NULL DEFAULT 0,
  error_code INTEGER,
  error_message TEXT,
  raw TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts);
CREATE INDEX IF NOT EXISTS idx_messages_session_ts ON messages(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_messages_tool ON messages(tool_name);
CREATE INDEX IF NOT EXISTS idx_messages_jsonrpc_id ON messages(jsonrpc_id);
`;

export class Logger extends EventEmitter {
  private db: DB;
  private insertStmt: Statement;
  private recentStmt: Statement;
  private bySessionStmt: Statement;
  private sessionId: string;

  constructor(opts: LoggerOptions) {
    super();
    this.sessionId = opts.sessionId;
    this.db = new Database(opts.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.exec(SCHEMA);

    this.insertStmt = this.db.prepare(`
      INSERT INTO messages
        (ts, session_id, direction, kind, jsonrpc_id, method, tool_name, is_error, error_code, error_message, raw)
      VALUES
        (@ts, @sessionId, @direction, @kind, @jsonrpcId, @method, @toolName, @isError, @errorCode, @errorMessage, @raw)
    `);
    this.recentStmt = this.db.prepare(
      "SELECT * FROM messages ORDER BY id DESC LIMIT ?",
    );
    this.bySessionStmt = this.db.prepare(
      "SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC",
    );
  }

  record(direction: Direction, frame: Frame): LogRow {
    const c = classify(frame);
    const row = {
      ts: Date.now(),
      sessionId: this.sessionId,
      direction,
      kind: c.kind,
      jsonrpcId: c.jsonrpcId,
      method: c.method,
      toolName: c.toolName,
      isError: c.isError ? 1 : 0,
      errorCode: c.errorCode,
      errorMessage: c.errorMessage,
      raw: frame.raw,
    };
    const info = this.insertStmt.run(row);
    const out: LogRow = {
      id: Number(info.lastInsertRowid),
      ts: row.ts,
      sessionId: row.sessionId,
      direction: row.direction,
      kind: row.kind,
      jsonrpcId: row.jsonrpcId,
      method: row.method,
      toolName: row.toolName,
      isError: c.isError,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      raw: row.raw,
    };
    this.emit("row", out);
    return out;
  }

  recent(limit = 200): LogRow[] {
    const rows = this.recentStmt.all(limit) as RawRow[];
    return rows.map(toLogRow).reverse();
  }

  bySession(sessionId: string): LogRow[] {
    const rows = this.bySessionStmt.all(sessionId) as RawRow[];
    return rows.map(toLogRow);
  }

  close(): void {
    this.db.close();
  }
}

type RawRow = {
  id: number;
  ts: number;
  session_id: string;
  direction: Direction;
  kind: LogRow["kind"];
  jsonrpc_id: string | null;
  method: string | null;
  tool_name: string | null;
  is_error: number;
  error_code: number | null;
  error_message: string | null;
  raw: string;
};

function toLogRow(r: RawRow): LogRow {
  return {
    id: r.id,
    ts: r.ts,
    sessionId: r.session_id,
    direction: r.direction,
    kind: r.kind,
    jsonrpcId: r.jsonrpc_id,
    method: r.method,
    toolName: r.tool_name,
    isError: r.is_error === 1,
    errorCode: r.error_code,
    errorMessage: r.error_message,
    raw: r.raw,
  };
}
