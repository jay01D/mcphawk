# Architecture

```
   MCP client                 mcptrace                 wrapped server
  (Claude, etc.)               (this)                  (your code)
       │                          │                          │
       │  json-rpc on stdin       │                          │
       ├─────────────────────────▶│                          │
       │                          │   write chunk to         │
       │                          ├─────────────────────────▶│
       │                          │                          │
       │                          │   read chunk from        │
       │                          │◀─────────────────────────┤
       │  json-rpc on stdout      │                          │
       │◀─────────────────────────┤                          │
       │                          │
       │                          ├──► FrameParser (newline-delimited frames)
       │                          │
       │                          ├──► Logger (SQLite + WAL)
       │                          │
       │                          ├──► EventEmitter ──► WebSocket ──► React dashboard
       │                          │
       │                          └──► risky.ts ──► stderr warnings
```

## Pieces

- **`src/proxy.ts`** spawns the child with piped stdio. Forwards every chunk in both directions verbatim. Wraps a `FrameParser` per direction so the bytes can be inspected without changing them.
- **`src/framing.ts`** turns a stream of bytes into newline-delimited JSON-RPC frames. Handles partial frames, CRLF, empty lines, and bad JSON.
- **`src/semconv.ts`** classifies a frame as `request`, `response`, `notification`, or `bad`, extracts the tool name from `tools/call` params, and pulls error codes out of error responses.
- **`src/logger.ts`** writes one row per frame into SQLite. Emits a `row` event so the dashboard can broadcast live.
- **`src/redact.ts`** runs regex-based replacements over the raw payload before it lands in SQLite. Default rules cover Bearer tokens, OpenAI/Anthropic keys, AWS access keys, JWTs, and `password`/`api_key`/`token` JSON fields.
- **`src/risky.ts`** inspects every client-side `tools/call` for risky tool names or argument patterns and surfaces them on stderr.
- **`src/dashboard/server.ts`** is Express + ws. Serves the built React app, exposes `/api/messages`, `/api/session/:id`, and `POST /api/replay/:id`, and pushes new rows to every connected WebSocket.
- **`src/replay/runner.ts`** spawns a fresh child for the same wrapped command, writes the captured request to its stdin, and reads back the first response with a matching JSON-RPC id (with timeout).
- **`src/exporter.ts`** reads `observe.db` and emits either a JSON array of rows or an OTLP-shaped trace JSON.
- **`dashboard/`** is the Vite + React + Tailwind UI. Builds into `dist/dashboard/public/`; the express server picks it up automatically.

## Wire format

All on-disk payloads are the raw JSON-RPC bytes that the proxy saw, after redaction. Nothing is reshaped before storage. The classified metadata (kind, method, tool name, error code, etc.) is a derived view stored alongside the raw payload, so you always have the original to fall back on.
