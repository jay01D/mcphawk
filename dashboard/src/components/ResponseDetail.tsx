import type { LogRow } from "../types.ts";
import { JsonTree } from "./JsonTree.tsx";
import { ReplayPanel } from "./ReplayPanel.tsx";

type Props = { row: LogRow | null };

export function ResponseDetail({ row }: Props) {
  if (!row) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        select a row to inspect the payload
      </div>
    );
  }

  const payload = safeParse(row.raw);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 px-5 py-3 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold">{row.method ?? row.kind}</span>
          {row.toolName && (
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
              {row.toolName}
            </span>
          )}
          {row.isError && (
            <span className="rounded bg-rose-950 px-2 py-0.5 text-xs text-rose-300">
              error {row.errorCode}
            </span>
          )}
        </div>
        <div className="mt-1 flex gap-4 text-xs text-slate-500">
          <span>id {row.jsonrpcId ?? "—"}</span>
          <span>{row.direction.replace("_", " → ").replace("_", " ")}</span>
          <span>{new Date(row.ts).toLocaleString()}</span>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-auto p-5 font-mono text-sm">
        <JsonTree value={payload} />
        {row.kind === "request" && <ReplayPanel row={row} />}
      </div>
    </div>
  );
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw };
  }
}
