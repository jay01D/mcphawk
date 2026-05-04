import { describe, expect, it } from "vitest";
import { FrameParser } from "../src/framing.js";

describe("FrameParser", () => {
  it("parses one full frame", () => {
    const p = new FrameParser();
    const out = p.push('{"jsonrpc":"2.0","id":1,"method":"ping"}\n');
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe("msg");
    if (out[0]?.kind === "msg") {
      expect(out[0].msg.method).toBe("ping");
      expect(out[0].msg.id).toBe(1);
    }
  });

  it("splits multiple frames in one chunk", () => {
    const p = new FrameParser();
    const out = p.push('{"jsonrpc":"2.0","id":1}\n{"jsonrpc":"2.0","id":2}\n');
    expect(out).toHaveLength(2);
    expect(out.every((f) => f.kind === "msg")).toBe(true);
  });

  it("buffers a partial frame across chunks", () => {
    const p = new FrameParser();
    expect(p.push('{"jsonrpc":"2.0","id"')).toHaveLength(0);
    const out = p.push(":3}\n");
    expect(out).toHaveLength(1);
    if (out[0]?.kind === "msg") expect(out[0].msg.id).toBe(3);
  });

  it("flags a bad json line but keeps parsing the rest", () => {
    const p = new FrameParser();
    const out = p.push('not json\n{"jsonrpc":"2.0","id":4}\n');
    expect(out).toHaveLength(2);
    expect(out[0]?.kind).toBe("bad");
    expect(out[1]?.kind).toBe("msg");
  });

  it("ignores empty lines", () => {
    const p = new FrameParser();
    const out = p.push('\n\n{"jsonrpc":"2.0","id":5}\n\n');
    expect(out).toHaveLength(1);
  });

  it("strips trailing \\r so CRLF frames work", () => {
    const p = new FrameParser();
    const out = p.push('{"jsonrpc":"2.0","id":6}\r\n');
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe("msg");
  });

  it("flush emits a buffered tail with no newline", () => {
    const p = new FrameParser();
    p.push('{"jsonrpc":"2.0","id":7}');
    const out = p.flush();
    expect(out).toHaveLength(1);
    if (out[0]?.kind === "msg") expect(out[0].msg.id).toBe(7);
  });

  it("flush returns nothing when buffer is empty or whitespace", () => {
    const p = new FrameParser();
    expect(p.flush()).toHaveLength(0);
    p.push("   ");
    expect(p.flush()).toHaveLength(0);
  });
});
