export type Direction = "client_to_server" | "server_to_client";
export type MessageKind = "request" | "response" | "notification" | "bad";

export type LogRow = {
  id: number;
  ts: number;
  sessionId: string;
  direction: Direction;
  kind: MessageKind;
  jsonrpcId: string | null;
  method: string | null;
  toolName: string | null;
  isError: boolean;
  errorCode: number | null;
  errorMessage: string | null;
  raw: string;
};

export type WsEvent = { type: "row"; row: LogRow };

export type ReplayOutcome = {
  raw: string | null;
  durationMs: number;
  timedOut: boolean;
  stderr: string;
};

export type ReplayResponse = {
  request: LogRow;
  original: LogRow | null;
  replay: ReplayOutcome;
};
