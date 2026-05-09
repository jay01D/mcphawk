# Dashboard tour

The dashboard lives at <http://localhost:4800> while mcptrace is running. It's a single-page React app served by the same process that runs the proxy.

## Layout

- **Header** — the mcptrace name, a live/offline badge for the WebSocket, and a filter input.
- **Left pane** — the timeline. One row per JSON-RPC frame. Newest at the bottom; the list auto-caps at 1000 rows in memory (the SQLite file keeps everything).
- **Right pane** — detail view for the selected row. Shows the parsed JSON, the request id, the direction, and a Replay button when the row is a request.

## Reading a timeline row

```
12:04:18.421  →  REQUEST   tools/call  read_file   id 4
```

- The arrow points **client → server** (`→`) or **server → client** (`←`).
- The colored badge is the message kind: `request`, `response`, `notification`, or `bad` for a frame that failed to parse.
- The tool name appears next to the method when it's a `tools/call`.
- A red error code shows up on the right when a response carries a JSON-RPC error.

## Filtering

Type into the filter box to narrow the timeline. The match runs across method name, tool name, kind, and error message. Empty filter shows everything.

## Connection states

The badge next to the title:

- **live** — WebSocket open, rows stream in as they happen.
- **connecting** — first attempt or backoff after a drop. The hook retries with exponential backoff up to 8 seconds.
- **offline** — server gone or unreachable. Refresh the page if it stays offline after mcptrace restarts.

## Where you'll get stuck

- **Nothing shows up.** The wrapped command never received any traffic. Check that your MCP client is pointing at `npx mcptrace -- <command>` and not the bare command.
- **Rows appear but the WebSocket says offline.** mcptrace is logging to SQLite but the dashboard server died. Check the terminal where you ran mcptrace.
- **Replay says "request not found".** The selected row is a response or a notification — replay is only valid on requests.
