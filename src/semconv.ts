import type { Frame, JsonRpcId, JsonRpcMessage } from "./framing.js";

export type MessageKind = "request" | "response" | "notification" | "bad";

export type Classified = {
  kind: MessageKind;
  jsonrpcId: string | null;
  method: string | null;
  toolName: string | null;
  isError: boolean;
  errorCode: number | null;
  errorMessage: string | null;
};

export function classify(frame: Frame): Classified {
  if (frame.kind === "bad") {
    return {
      kind: "bad",
      jsonrpcId: null,
      method: null,
      toolName: null,
      isError: true,
      errorCode: null,
      errorMessage: frame.error,
    };
  }
  return classifyMessage(frame.msg);
}

export function classifyMessage(m: JsonRpcMessage): Classified {
  const hasId = m.id !== undefined && m.id !== null;
  const hasMethod = typeof m.method === "string";

  if (hasMethod && hasId) {
    return {
      kind: "request",
      jsonrpcId: idToString(m.id),
      method: m.method ?? null,
      toolName: extractToolName(m),
      isError: false,
      errorCode: null,
      errorMessage: null,
    };
  }
  if (hasMethod && !hasId) {
    return {
      kind: "notification",
      jsonrpcId: null,
      method: m.method ?? null,
      toolName: null,
      isError: false,
      errorCode: null,
      errorMessage: null,
    };
  }
  if (m.error) {
    return {
      kind: "response",
      jsonrpcId: idToString(m.id),
      method: null,
      toolName: null,
      isError: true,
      errorCode: m.error.code,
      errorMessage: m.error.message,
    };
  }
  return {
    kind: "response",
    jsonrpcId: idToString(m.id),
    method: null,
    toolName: null,
    isError: false,
    errorCode: null,
    errorMessage: null,
  };
}

function idToString(id: JsonRpcId | undefined): string | null {
  if (id === undefined || id === null) return null;
  return String(id);
}

function extractToolName(m: JsonRpcMessage): string | null {
  if (m.method !== "tools/call") return null;
  const params = m.params;
  if (params && typeof params === "object" && "name" in params) {
    const name = (params as { name: unknown }).name;
    return typeof name === "string" ? name : null;
  }
  return null;
}
