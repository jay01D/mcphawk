import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin });

rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg: { id?: unknown; method?: string; params?: { name?: string } };
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (typeof msg.method !== "string") return;

  if (msg.method === "tools/list") {
    respond(msg.id, {
      tools: [{ name: "read_file", description: "read a file" }],
    });
    return;
  }
  if (msg.method === "tools/call") {
    const name = msg.params?.name;
    if (name === "read_file") respond(msg.id, { content: "hello" });
    else fail(msg.id, -32601, `unknown tool: ${name}`);
    return;
  }
  if (msg.method === "ping") {
    respond(msg.id, {});
    return;
  }
  fail(msg.id, -32601, `method not found: ${msg.method}`);
});

function respond(id: unknown, result: unknown) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function fail(id: unknown, code: number, message: string) {
  process.stdout.write(
    `${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`,
  );
}
