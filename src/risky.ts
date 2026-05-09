import type { JsonRpcMessage } from "./framing.js";

const RISKY_TOOL_NAMES = [
  /shell/i,
  /\bexec\b/i,
  /spawn/i,
  /\bdelete\b/i,
  /unlink/i,
  /\bremove\b/i,
  /\brm\b/i,
  /destroy/i,
  /drop_table/i,
];

const RISKY_ARG_PATTERNS = [
  /\brm\s+-rf?\b/i,
  /\bsudo\b/i,
  /\bcurl\s+.*\|\s*(sh|bash)/i,
  /\bdrop\s+table\b/i,
];

export type Risk = { reason: string; detail: string };

export function inspectRequest(msg: JsonRpcMessage): Risk[] {
  if (msg.method !== "tools/call") return [];
  const params = msg.params as
    | { name?: unknown; arguments?: unknown }
    | undefined;
  const name = typeof params?.name === "string" ? params.name : null;
  const out: Risk[] = [];

  if (name && RISKY_TOOL_NAMES.some((re) => re.test(name))) {
    out.push({ reason: "risky-tool-name", detail: name });
  }

  const argsText = params?.arguments ? JSON.stringify(params.arguments) : "";
  for (const re of RISKY_ARG_PATTERNS) {
    const match = re.exec(argsText);
    if (match) out.push({ reason: "risky-argument", detail: match[0] });
  }

  return out;
}
