#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { type Dashboard, startDashboard } from "./dashboard/server.js";
import type { Frame } from "./framing.js";
import { Logger } from "./logger.js";
import { type Direction, Proxy } from "./proxy.js";
import { Redactor } from "./redact.js";
import { inspectRequest } from "./risky.js";

export type CliArgs = {
  port: number;
  dbPath: string;
  dashboard: boolean;
  quiet: boolean;
  redact: boolean;
  riskyCheck: boolean;
  help: boolean;
  command: string | null;
  commandArgs: string[];
};

export const HELP_TEXT = `mcptrace - transparent stdio proxy for MCP servers

usage:
  mcptrace [options] -- <command> [args...]

options:
  --port <n>          dashboard port (default 4800)
  --db <path>         sqlite path (default ./observe.db)
  --no-dashboard      skip the dashboard, log only
  --no-redact         disable secret redaction before storage
  --no-risky-check    silence risky tool/argument warnings
  --quiet             suppress info logs
  -h, --help          show this help

examples:
  mcptrace -- node my-server.js
  mcptrace --port 5000 -- python my_server.py
  mcptrace --no-dashboard -- bun run server.ts
`;

export function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    port: 4800,
    dbPath: "./observe.db",
    dashboard: true,
    quiet: false,
    redact: true,
    riskyCheck: true,
    help: false,
    command: null,
    commandArgs: [],
  };

  const sep = argv.indexOf("--");
  const opts = sep === -1 ? argv : argv.slice(0, sep);
  const rest = sep === -1 ? [] : argv.slice(sep + 1);

  for (let i = 0; i < opts.length; i++) {
    const a = opts[i];
    if (a === "-h" || a === "--help") out.help = true;
    else if (a === "--no-dashboard") out.dashboard = false;
    else if (a === "--no-redact") out.redact = false;
    else if (a === "--no-risky-check") out.riskyCheck = false;
    else if (a === "--quiet") out.quiet = true;
    else if (a === "--port") {
      const v = opts[++i];
      if (!v) throw new Error("--port needs a value");
      out.port = Number.parseInt(v, 10);
      if (!Number.isFinite(out.port))
        throw new Error(`--port must be a number, got ${v}`);
    } else if (a === "--db") {
      const v = opts[++i];
      if (!v) throw new Error("--db needs a path");
      out.dbPath = v;
    } else {
      throw new Error(`unknown option: ${a}`);
    }
  }

  if (rest.length > 0) {
    out.command = rest[0] ?? null;
    out.commandArgs = rest.slice(1);
  }
  return out;
}

export async function run(argv: string[]): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`mcptrace: ${(err as Error).message}\n\n${HELP_TEXT}`);
    return 2;
  }

  if (args.help || args.command === null) {
    process.stdout.write(HELP_TEXT);
    return args.help ? 0 : 2;
  }

  const sessionId = randomUUID();
  const redactor = args.redact ? new Redactor() : undefined;
  const logger = new Logger({
    dbPath: resolve(args.dbPath),
    sessionId,
    redactor,
  });
  const proxy = new Proxy();

  let dashboard: Dashboard | null = null;
  if (args.dashboard) {
    dashboard = await startDashboard({
      port: args.port,
      logger,
      wrappedCommand: args.command,
      wrappedArgs: args.commandArgs,
    });
    if (!args.quiet)
      process.stderr.write(`mcptrace dashboard: ${dashboard.url}\n`);
  }

  proxy.on("frame", (dir: Direction, frame: Frame) => {
    logger.record(dir, frame);
    if (args.riskyCheck && dir === "client_to_server" && frame.kind === "msg") {
      const risks = inspectRequest(frame.msg);
      for (const r of risks) {
        process.stderr.write(`mcptrace warn [${r.reason}]: ${r.detail}\n`);
      }
    }
  });

  const child = proxy.start({ command: args.command, args: args.commandArgs });

  let exiting = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (exiting) return;
    exiting = true;
    proxy.kill(signal);
    if (dashboard) await dashboard.close();
    logger.close();
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  return await new Promise<number>((done) => {
    child.on("exit", async (code) => {
      if (dashboard) await dashboard.close();
      logger.close();
      done(code ?? 0);
    });
  });
}

const invokedAsScript =
  process.argv[1]?.endsWith("cli.js") || process.argv[1]?.endsWith("cli.ts");
if (invokedAsScript) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`mcptrace: ${(err as Error).message}\n`);
      process.exit(1);
    },
  );
}
