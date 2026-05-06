import { existsSync } from "node:fs";
import { createServer, type Server as HttpServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketServer, type WebSocket } from "ws";
import type { Logger, LogRow } from "../logger.js";

export type DashboardOptions = {
  port: number;
  logger: Logger;
};

export type Dashboard = {
  url: string;
  close: () => Promise<void>;
};

const here = dirname(fileURLToPath(import.meta.url));
const staticDir = resolve(here, "public");

const placeholderHtml = `<!doctype html>
<html><head><meta charset="utf-8"><title>mcptrace</title></head>
<body style="font-family:system-ui;padding:2rem;color:#333">
<h1>mcptrace</h1>
<p>Dashboard bundle missing. Run <code>npm run build</code>.</p>
</body></html>`;

export function startDashboard(opts: DashboardOptions): Promise<Dashboard> {
  const app = express();

  app.get("/api/messages", (req, res) => {
    const limit = clampLimit(req.query.limit);
    res.json({ data: opts.logger.recent(limit), error: null, message: null });
  });

  app.get("/api/session/:id", (req, res) => {
    res.json({
      data: opts.logger.bySession(req.params.id),
      error: null,
      message: null,
    });
  });

  if (existsSync(staticDir)) {
    app.use(express.static(staticDir));
  } else {
    app.get("/", (_req, res) => res.type("html").send(placeholderHtml));
  }

  const http: HttpServer = createServer(app);
  const wss = new WebSocketServer({ server: http, path: "/ws" });

  const sockets = new Set<WebSocket>();
  wss.on("connection", (sock) => {
    sockets.add(sock);
    sock.on("close", () => sockets.delete(sock));
    for (const row of opts.logger.recent(200)) {
      sock.send(JSON.stringify({ type: "row", row }));
    }
  });

  const onRow = (row: LogRow) => {
    const payload = JSON.stringify({ type: "row", row });
    for (const s of sockets) {
      if (s.readyState === s.OPEN) s.send(payload);
    }
  };
  opts.logger.on("row", onRow);

  return new Promise((resolveStart) => {
    http.listen(opts.port, () => {
      resolveStart({
        url: `http://localhost:${opts.port}`,
        close: () =>
          new Promise<void>((done) => {
            opts.logger.off("row", onRow);
            for (const s of sockets) s.close();
            wss.close(() => http.close(() => done()));
          }),
      });
    });
  });
}

function clampLimit(input: unknown): number {
  const n = typeof input === "string" ? Number.parseInt(input, 10) : Number.NaN;
  if (!Number.isFinite(n) || n <= 0) return 200;
  return Math.min(n, 2000);
}
