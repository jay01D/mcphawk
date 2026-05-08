import { useState } from "react";
import type { LogRow, ReplayResponse } from "../types.ts";
import { JsonTree } from "./JsonTree.tsx";

type Props = { row: LogRow };

export function ReplayPanel({ row }: Props) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [result, setResult] = useState<ReplayResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setState("running");
    setErr(null);
    try {
      const r = await fetch(`/api/replay/${row.id}`, { method: "POST" });
      const body = (await r.json()) as {
        data: ReplayResponse | null;
        error: string | null;
      };
      if (body.error) throw new Error(body.error);
      setResult(body.data);
      setState("done");
    } catch (e) {
      setErr((e as Error).message);
      setState("error");
    }
  }

  if (row.kind !== "request") {
    return (
      <div className="rounded border border-slate-800 px-4 py-3 text-xs text-slate-500">
        replay is available on request rows only.
      </div>
    );
  }

  return (
    <div className="rounded border border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          replay
        </span>
        <button
          type="button"
          onClick={run}
          disabled={state === "running"}
          className="rounded bg-sky-700 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
        >
          {state === "running" ? "running…" : "replay"}
        </button>
      </div>
      {state === "error" && (
        <div className="px-4 py-3 text-xs text-rose-300">{err}</div>
      )}
      {result && <ReplayResult result={result} />}
    </div>
  );
}

function ReplayResult({ result }: { result: ReplayResponse }) {
  const original = parseRaw(result.original?.raw);
  const replay = parseRaw(result.replay.raw);

  return (
    <div className="grid grid-cols-2 divide-x divide-slate-800 text-xs">
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between text-slate-500">
          <span className="uppercase tracking-wide">original</span>
          {result.original && <span>id {result.original.id}</span>}
        </div>
        {original ? (
          <JsonTree value={original} />
        ) : (
          <span className="text-slate-600">no captured response</span>
        )}
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between text-slate-500">
          <span className="uppercase tracking-wide">replay</span>
          <span>{result.replay.durationMs} ms</span>
        </div>
        {result.replay.timedOut && (
          <div className="mb-2 text-rose-300">timed out</div>
        )}
        {replay ? (
          <JsonTree value={replay} />
        ) : (
          <span className="text-slate-600">no response</span>
        )}
        {result.replay.stderr && (
          <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-900 p-2 text-rose-300">
            {result.replay.stderr}
          </pre>
        )}
      </div>
    </div>
  );
}

function parseRaw(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw };
  }
}
