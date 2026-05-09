# Replay

Replay takes any captured JSON-RPC request and re-sends it to a fresh instance of the wrapped server. You see what the server returns now, next to what it returned when the original call happened.

## When you'd use it

- **Reproducing a bug.** A tool failed an hour ago. Click the row, hit Replay. The proxy spawns the server again with the same command, writes the captured request to its stdin, and shows you the new response. No need to coax Claude into running the same prompt.
- **Verifying a fix.** You patched the server. Pull up the call that broke, replay it. The "original" pane still has yesterday's failure; the "replay" pane shows whether your fix took.
- **Audit.** Show someone exactly what request was made and what the server did with it, without any of the surrounding conversation context.

## How to run a replay

1. Click any **request** row in the timeline. The detail pane fills in.
2. Click **Replay** at the bottom of the detail pane.
3. The button flips to "running…" while the proxy spawns the wrapped command, writes the request, and waits for a response that shares the same JSON-RPC id.
4. When it returns, you'll see two panes side-by-side:
   - **original** — the response that was captured during the live session (`null` if the request had no captured response yet).
   - **replay** — what the server just said.

## What "fresh" means

Each replay spawns a brand-new child process with the same command and args. No environment state from the original session leaks in. If the wrapped server holds in-memory state, the replay starts cold.

If you need state — say, the server reads from a database that has changed — the replay will reflect the current state of that database. That's usually what you want for "did this still fail" checks; it's not what you want if you're trying to reproduce a bug that depended on past in-memory state.

## Timeouts and failures

The replay engine waits up to 5 seconds for a matching response. If the server hangs, the dashboard shows **timed out** and the partial stderr from the child. If the server prints to stderr instead of stdout, that text shows up below the replay JSON.

## Where you'll get stuck

- **"request not found".** The row you clicked was a response, not a request.
- **Replay returns null.** The server started but never wrote a response on stdout within the timeout. Check the stderr panel — most likely the wrapped command needs an init or handshake before tools work, and replay doesn't do init for you.
- **Replay drifts from original.** That's the point. Confirm the wrapped server didn't change between capture and replay — if its environment or backend store changed, behavior will too.
