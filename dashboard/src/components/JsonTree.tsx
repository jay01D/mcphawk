import { useState } from "react";

type Props = { value: unknown; depth?: number };

export function JsonTree({ value, depth = 0 }: Props) {
  if (value === null) return <span className="text-rose-300">null</span>;
  if (typeof value === "string")
    return <span className="text-emerald-300">"{value}"</span>;
  if (typeof value === "number" || typeof value === "boolean")
    return <span className="text-amber-300">{String(value)}</span>;

  if (Array.isArray(value)) return <ArrayNode items={value} depth={depth} />;
  if (typeof value === "object")
    return <ObjectNode obj={value as Record<string, unknown>} depth={depth} />;

  return <span>{String(value)}</span>;
}

function ObjectNode({
  obj,
  depth,
}: {
  obj: Record<string, unknown>;
  depth: number;
}) {
  const entries = Object.entries(obj);
  const [open, setOpen] = useState(depth < 2);
  if (entries.length === 0)
    return <span className="text-slate-500">{"{}"}</span>;
  return (
    <span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-slate-500 hover:text-slate-300"
      >
        {open ? "{" : `{ ${entries.length} keys }`}
      </button>
      {open && (
        <div className="ml-4 border-l border-slate-800 pl-3">
          {entries.map(([k, v]) => (
            <div key={k}>
              <span className="text-sky-300">"{k}"</span>
              <span className="text-slate-500">: </span>
              <JsonTree value={v} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
      {open && <span className="text-slate-500">{"}"}</span>}
    </span>
  );
}

function ArrayNode({ items, depth }: { items: unknown[]; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  if (items.length === 0) return <span className="text-slate-500">[]</span>;
  return (
    <span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-slate-500 hover:text-slate-300"
      >
        {open ? "[" : `[ ${items.length} items ]`}
      </button>
      {open && (
        <div className="ml-4 border-l border-slate-800 pl-3">
          {items.map((v, i) => (
            <div key={`${depth}-${i}`}>
              <span className="text-slate-500">{i}: </span>
              <JsonTree value={v} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
      {open && <span className="text-slate-500">]</span>}
    </span>
  );
}
