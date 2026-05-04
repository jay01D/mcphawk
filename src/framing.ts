export type JsonRpcId = number | string | null;

export type JsonRpcMessage = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type Frame =
  | { kind: "msg"; raw: string; msg: JsonRpcMessage }
  | { kind: "bad"; raw: string; error: string };

export class FrameParser {
  private buffer = "";

  push(chunk: Buffer | string): Frame[] {
    this.buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    const out: Frame[] = [];
    let nl = this.buffer.indexOf("\n");
    while (nl !== -1) {
      const line = this.buffer.slice(0, nl).replace(/\r$/, "");
      this.buffer = this.buffer.slice(nl + 1);
      if (line.length > 0) out.push(parseLine(line));
      nl = this.buffer.indexOf("\n");
    }
    return out;
  }

  flush(): Frame[] {
    const rest = this.buffer.trim();
    this.buffer = "";
    return rest.length === 0 ? [] : [parseLine(rest)];
  }
}

function parseLine(line: string): Frame {
  try {
    const msg = JSON.parse(line) as JsonRpcMessage;
    return { kind: "msg", raw: line, msg };
  } catch (err) {
    return { kind: "bad", raw: line, error: (err as Error).message };
  }
}
