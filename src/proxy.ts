import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { type Frame, FrameParser } from "./framing.js";

export type Direction = "client_to_server" | "server_to_client";

export type ProxyOptions = {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
};

export class Proxy extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private fromClient = new FrameParser();
  private fromServer = new FrameParser();

  start(opts: ProxyOptions): ChildProcessWithoutNullStreams {
    const child = spawn(opts.command, opts.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: opts.env ?? process.env,
      cwd: opts.cwd,
    });
    this.child = child;

    process.stdin.on("data", (chunk: Buffer) => {
      child.stdin.write(chunk);
      for (const f of this.fromClient.push(chunk)) {
        this.emit("frame", "client_to_server", f);
      }
    });

    child.stdout.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
      for (const f of this.fromServer.push(chunk)) {
        this.emit("frame", "server_to_client", f);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
      this.emit("stderr", chunk);
    });

    child.on("exit", (code, signal) => {
      for (const f of this.fromClient.flush())
        this.emit("frame", "client_to_server", f);
      for (const f of this.fromServer.flush())
        this.emit("frame", "server_to_client", f);
      this.emit("exit", code, signal);
    });

    return child;
  }

  kill(signal: NodeJS.Signals = "SIGTERM"): void {
    this.child?.kill(signal);
  }
}
