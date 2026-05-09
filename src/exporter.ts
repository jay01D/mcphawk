import { randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import type { LogRow } from "./logger.js";

export type ExportFormat = "json" | "otel";

export type ExportOptions = {
  dbPath: string;
  format: ExportFormat;
  sessionId?: string;
};

export function exportRows(opts: ExportOptions): string {
  const rows = readRows(opts.dbPath, opts.sessionId);
  if (opts.format === "json") return JSON.stringify(rows, null, 2);
  return JSON.stringify(toOtlp(rows), null, 2);
}

function readRows(dbPath: string, sessionId?: string): LogRow[] {
  const db = new Database(dbPath, { readonly: true });
  try {
    const sql = sessionId
      ? "SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC"
      : "SELECT * FROM messages ORDER BY id ASC";
    const raw = (
      sessionId ? db.prepare(sql).all(sessionId) : db.prepare(sql).all()
    ) as RawRow[];
    return raw.map(toLogRow);
  } finally {
    db.close();
  }
}

type RawRow = {
  id: number;
  ts: number;
  session_id: string;
  direction: LogRow["direction"];
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

type OtlpSpan = {
  traceId: string;
  spanId: string;
  name: string;
  kind: "SPAN_KIND_INTERNAL" | "SPAN_KIND_CLIENT";
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Array<{
    key: string;
    value: { stringValue?: string; intValue?: string };
  }>;
  status: { code: 0 | 2; message?: string };
};

function toOtlp(rows: LogRow[]): {
  resourceSpans: Array<{
    resource: {
      attributes: Array<{ key: string; value: { stringValue: string } }>;
    };
    scopeSpans: Array<{ scope: { name: string }; spans: OtlpSpan[] }>;
  }>;
} {
  const pairs = new Map<string, { request: LogRow; response?: LogRow }>();
  for (const r of rows) {
    if (r.jsonrpcId === null) continue;
    const key = `${r.sessionId}:${r.jsonrpcId}`;
    const slot = pairs.get(key) ?? { request: r };
    if (r.kind === "request") slot.request = r;
    else if (r.kind === "response") slot.response = r;
    pairs.set(key, slot);
  }

  const spans: OtlpSpan[] = [];
  for (const { request, response } of pairs.values()) {
    if (!request || request.kind !== "request") continue;
    const start = BigInt(request.ts) * 1_000_000n;
    const end = response ? BigInt(response.ts) * 1_000_000n : start;
    spans.push({
      traceId: hexId(16),
      spanId: hexId(8),
      name: request.method ?? "mcp.unknown",
      kind: "SPAN_KIND_CLIENT",
      startTimeUnixNano: start.toString(),
      endTimeUnixNano: end.toString(),
      attributes: [
        kv("mcp.method", request.method ?? ""),
        kv("mcp.request_id", request.jsonrpcId ?? ""),
        kv("mcp.tool_name", request.toolName ?? ""),
        kv("mcp.session_id", request.sessionId),
      ],
      status: response?.isError
        ? { code: 2, message: response.errorMessage ?? "error" }
        : { code: 0 },
    });
  }

  return {
    resourceSpans: [
      {
        resource: { attributes: [kv("service.name", "mcphawk")] },
        scopeSpans: [{ scope: { name: "mcphawk" }, spans }],
      },
    ],
  };
}

function kv(key: string, value: string) {
  return { key, value: { stringValue: value } };
}

function hexId(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}
