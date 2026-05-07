import type { LogRow } from "../types.ts";

type Props = {
  row: LogRow;
  selected: boolean;
  onSelect: () => void;
};

export function RequestRow({ row, selected, onSelect }: Props) {
  const arrow = row.direction === "client_to_server" ? "→" : "←";
  const arrowColor =
    row.direction === "client_to_server" ? "text-sky-400" : "text-violet-400";
  const label = row.toolName ?? row.method ?? row.kind;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full border-l-2 px-4 py-2 text-left font-mono text-sm transition-colors ${
        selected
          ? "border-l-sky-400 bg-slate-900"
          : "border-l-transparent hover:bg-slate-900/60"
      }`}
    >
      <span className="text-slate-500">{formatTime(row.ts)}</span>
      <span className={`mx-3 ${arrowColor}`}>{arrow}</span>
      <KindBadge row={row} />
      <span className="ml-2 text-slate-100">{label}</span>
      {row.isError && (
        <span className="ml-3 rounded bg-rose-950 px-1.5 py-0.5 text-xs text-rose-300">
          {row.errorCode ?? "err"}
        </span>
      )}
      {row.jsonrpcId !== null && (
        <span className="ml-3 text-xs text-slate-600">id {row.jsonrpcId}</span>
      )}
    </button>
  );
}

function KindBadge({ row }: { row: LogRow }) {
  const map: Record<LogRow["kind"], string> = {
    request: "bg-sky-950 text-sky-300",
    response: "bg-emerald-950 text-emerald-300",
    notification: "bg-amber-950 text-amber-300",
    bad: "bg-rose-950 text-rose-300",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs uppercase tracking-wide ${map[row.kind]}`}
    >
      {row.kind}
    </span>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}
