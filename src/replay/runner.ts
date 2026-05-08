import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { FrameParser, type JsonRpcMessage } from "../framing.js";

export type ReplayOptions = {
  command: string;
  args: string[];
  request: string;
  timeoutMs?: number;
};

export type ReplayOutcome = {
  raw: string | null;
  durationMs: number;
  timedOut: boolean;
  stderr: string;
};

export async function runReplay(opts: ReplayOptions): Promise<ReplayOutcome> {
  const timeoutMs = opts.timeoutMs ?? 5_000;
  const parsed = safeJson(opts.request);
  const targetId = parsed?.id ?? null;

  const child = spawn(opts.command, opts.args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });

  const parser = new FrameParser();
  let matched: string | null = null;
  let stderr = "";

  const matchedPromise = new Promise<void>((resolve) => {
    child.stdout.on("data", (chunk: Buffer) => {
      for (const frame of parser.push(chunk)) {
        if (frame.kind !== "msg") continue;
        if (targetId === null || equalIds(frame.msg.id, targetId)) {
          matched = frame.raw;
          resolve();
          return;
        }
      }
    });
  });

  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const started = Date.now();
  child.stdin.write(
    opts.request.endsWith("\n") ? opts.request : `${opts.request}\n`,
  );

  const timer = sleep(timeoutMs).then(() => "timeout" as const);
  const winner = await Promise.race([
    matchedPromise.then(() => "matched" as const),
    timer,
  ]);

  child.stdin.end();
  child.kill();
  const durationMs = Date.now() - started;

  return {
    raw: matched,
    durationMs,
    timedOut: winner === "timeout",
    stderr,
  };
}

function safeJson(raw: string): JsonRpcMessage | null {
  try {
    return JSON.parse(raw) as JsonRpcMessage;
  } catch {
    return null;
  }
}

function equalIds(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined)
    return false;
  return String(a) === String(b);
}
