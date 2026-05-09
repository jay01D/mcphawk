# SQL recipes

Useful queries against `observe.db`. Open it with any SQLite client:

```bash
sqlite3 ./observe.db
```

## All errors in the last hour

```sql
SELECT datetime(ts/1000, 'unixepoch') AS at, method, error_code, error_message
FROM messages
WHERE is_error = 1
  AND ts > (strftime('%s', 'now') - 3600) * 1000
ORDER BY ts DESC;
```

## Tool call counts

```sql
SELECT tool_name, COUNT(*) AS calls
FROM messages
WHERE tool_name IS NOT NULL
GROUP BY tool_name
ORDER BY calls DESC;
```

## Latency per request (request to paired response)

```sql
SELECT
  req.method,
  resp.ts - req.ts AS latency_ms
FROM messages AS req
JOIN messages AS resp
  ON resp.session_id = req.session_id
 AND resp.jsonrpc_id = req.jsonrpc_id
 AND resp.kind = 'response'
WHERE req.kind = 'request'
ORDER BY latency_ms DESC
LIMIT 50;
```

## Methods called per session

```sql
SELECT session_id, method, COUNT(*) AS hits
FROM messages
WHERE kind = 'request'
GROUP BY session_id, method
ORDER BY session_id, hits DESC;
```

## Find a tool that failed at least once

```sql
SELECT DISTINCT tool_name
FROM messages
WHERE tool_name IS NOT NULL
  AND jsonrpc_id IN (
    SELECT jsonrpc_id FROM messages WHERE is_error = 1
  );
```

## How big is the DB?

```sql
SELECT COUNT(*) AS rows, SUM(LENGTH(raw)) / 1024 AS raw_kb FROM messages;
```
