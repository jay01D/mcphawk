import { useEffect, useRef, useState } from "react";
import type { LogRow, WsEvent } from "../types.ts";

const MAX_ROWS = 1000;

export type StreamState = "connecting" | "open" | "closed";

export function useLiveStream(): { rows: LogRow[]; state: StreamState } {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [state, setState] = useState<StreamState>("connecting");
  const retryRef = useRef(0);

  useEffect(() => {
    let sock: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      setState("connecting");
      const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
      sock = new WebSocket(url);

      sock.onopen = () => {
        retryRef.current = 0;
        setState("open");
      };

      sock.onmessage = (e) => {
        let evt: WsEvent;
        try {
          evt = JSON.parse(typeof e.data === "string" ? e.data : "") as WsEvent;
        } catch {
          return;
        }
        if (evt.type !== "row") return;
        setRows((prev) => {
          const next = prev.concat(evt.row);
          return next.length > MAX_ROWS ? next.slice(-MAX_ROWS) : next;
        });
      };

      sock.onclose = () => {
        setState("closed");
        if (stopped) return;
        const wait = Math.min(500 * 2 ** retryRef.current, 8000);
        retryRef.current += 1;
        timer = setTimeout(connect, wait);
      };

      sock.onerror = () => sock?.close();
    };

    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      sock?.close();
    };
  }, []);

  return { rows, state };
}
