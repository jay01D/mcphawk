import { useMemo, useState } from "react";
import { ConnectionBadge } from "./components/ConnectionBadge.tsx";
import { RequestRow } from "./components/RequestRow.tsx";
import { ResponseDetail } from "./components/ResponseDetail.tsx";
import { useLiveStream } from "./hooks/useLiveStream.ts";
import type { LogRow } from "./types.ts";

export function App() {
  const { rows, state } = useLiveStream();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => filterRows(rows, filter), [rows, filter]);
  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <div className="flex items-center">
          <span className="font-mono text-lg font-semibold tracking-tight">
            mcphawk
          </span>
          <ConnectionBadge state={state} />
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter by method or tool…"
          className="w-72 rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm font-mono placeholder:text-slate-600 focus:border-sky-700 focus:outline-none"
        />
      </header>

      <main className="grid flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] overflow-hidden">
        <section className="overflow-y-auto border-r border-slate-800">
          {visible.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-500">
              waiting for traffic… pipe an mcp client through mcphawk to start.
            </div>
          )}
          {visible.map((row) => (
            <RequestRow
              key={row.id}
              row={row}
              selected={row.id === selectedId}
              onSelect={() => setSelectedId(row.id)}
            />
          ))}
        </section>
        <section className="overflow-hidden">
          <ResponseDetail row={selected} />
        </section>
      </main>
    </div>
  );
}

function filterRows(rows: LogRow[], q: string): LogRow[] {
  const term = q.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((r) => {
    const hay = [r.method, r.toolName, r.kind, r.errorMessage]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(term);
  });
}
