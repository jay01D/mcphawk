# mcptrace

Transparent stdio proxy for MCP servers. See every JSON-RPC call your agent makes, capture it to SQLite, and replay it later. Zero config. Works with any MCP server.

Think `mitmproxy`, but for the Model Context Protocol.

## Quickstart

```bash
npx mcptrace -- node my-server.js
```

Then open <http://localhost:4800>.

That's it — no SDK, no config file, no code change in the wrapped server. The MCP client (Claude, Cursor, etc.) talks to mcptrace as if it were the server, and the server runs unchanged.

## Install

```bash
npm install -g mcptrace
```

Requires Node 20+. Also runs under Bun (`bunx mcptrace ...`).

## Use with Claude Desktop

You almost certainly want to drop mcptrace in front of an MCP server you've already registered in Claude Desktop. Find the config:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Wrap the existing entry. Before:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/server.js"]
    }
  }
}
```

After:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["mcptrace", "--", "node", "/path/to/server.js"]
    }
  }
}
```

Restart Claude Desktop, open <http://localhost:4800>, chat normally, and every tool call streams into the timeline.

Same pattern works for Cursor, Continue, and anything else that spawns an MCP server over stdio.

## What you get

- **Live timeline** — every JSON-RPC frame in both directions, with tool names, latency, and error codes
- **Replay** — click any request, hit Replay, see how the server answers right now versus how it answered when the call was captured
- **SQLite log** — every frame persisted to `./observe.db`. Query with the `sqlite3` CLI or any client
- **Secret redaction** — Bearer tokens, OpenAI/Anthropic keys, AWS keys, JWTs, and `password`/`api_key`/`token` JSON fields masked before they hit disk
- **Risky-tool warnings** — flags `tools/call` invocations whose name or arguments look like `rm -rf`, `sudo`, `drop table`, etc.
- **OTLP export** — `mcptrace export --format=otel` produces OpenTelemetry traces ready to ship to any backend that speaks OTLP

## More examples

```bash
# wrap a python server
mcptrace -- python my_server.py

# wrap an npm-published server
mcptrace -- npx -y @modelcontextprotocol/server-filesystem /Users/me/docs

# wrap a bun script
mcptrace -- bun run server.ts

# log only, no dashboard
mcptrace --no-dashboard -- node my-server.js

# custom port and database path
mcptrace --port 5001 --db ./debug.db -- node my-server.js
```

## Options

| Flag               | Default        | What it does                            |
| ------------------ | -------------- | --------------------------------------- |
| `--port <n>`       | `4800`         | Dashboard HTTP port                     |
| `--db <path>`      | `./observe.db` | SQLite file location                    |
| `--no-dashboard`   | off            | Skip the dashboard, log to SQLite only  |
| `--no-redact`      | off            | Disable secret redaction before storage |
| `--no-risky-check` | off            | Silence risky tool/argument warnings    |
| `--quiet`          | off            | Suppress info logs                      |
| `-h`, `--help`     | —              | Show help                               |

## Export

`mcptrace export` reads a database file and writes either a raw JSON array of rows or an OpenTelemetry OTLP trace JSON.

```bash
mcptrace export --format=json --out trace.json
mcptrace export --format=otel --out trace.otlp.json
mcptrace export --format=json --session <uuid>
```

## Query the SQLite log

The dashboard is for live work. The SQLite file is the permanent record — useful for post-mortems and metrics.

```bash
sqlite3 ./observe.db
```

A few starter queries live in [docs/sql-recipes.md](docs/sql-recipes.md).

## How it works

mcptrace spawns the wrapped command as a child process with piped stdio. It reads from its own stdin (whatever the MCP client writes), parses newline-delimited JSON-RPC frames, logs them, and forwards each chunk unchanged to the child's stdin. Same flow in reverse for the child's stdout. Neither side notices the middleman.

The dashboard is a small Express server with a WebSocket that streams every logged row to a Vite/React UI. The replay engine spawns a fresh copy of the same wrapped command, writes the captured JSON-RPC request to its stdin, waits for a matching response on stdout, and returns both. No state from the original session leaks in.

## Docs

- [docs/dashboard.md](docs/dashboard.md) — UI tour
- [docs/replay.md](docs/replay.md) — when and how to use replay
- [docs/sql-recipes.md](docs/sql-recipes.md) — useful queries against `observe.db`
- [docs/architecture.md](docs/architecture.md) — one diagram, one paragraph per box

## Development

```bash
git clone https://github.com/jay01D/mcptrace
cd mcptrace
npm install
npm run build
npm test
```

Run the proxy from source against a fake MCP server fixture:

```bash
npm run dev -- -- npx tsx test/fixtures/fakeMcpServer.ts
```

## License

MIT
