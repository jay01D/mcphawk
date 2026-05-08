export type DiffNode =
  | { kind: "same"; value: unknown }
  | { kind: "changed"; before: unknown; after: unknown }
  | { kind: "object"; entries: Array<{ key: string; diff: DiffNode }> }
  | { kind: "array"; items: DiffNode[] }
  | { kind: "added"; value: unknown }
  | { kind: "removed"; value: unknown };

export function diffJson(before: unknown, after: unknown): DiffNode {
  if (before === undefined && after !== undefined)
    return { kind: "added", value: after };
  if (before !== undefined && after === undefined)
    return { kind: "removed", value: before };
  if (isPlainObject(before) && isPlainObject(after))
    return diffObjects(before, after);
  if (Array.isArray(before) && Array.isArray(after))
    return diffArrays(before, after);
  if (Object.is(before, after)) return { kind: "same", value: before };
  return { kind: "changed", before, after };
}

function diffObjects(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): DiffNode {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const entries: Array<{ key: string; diff: DiffNode }> = [];
  for (const key of keys) {
    entries.push({ key, diff: diffJson(a[key], b[key]) });
  }
  return { kind: "object", entries };
}

function diffArrays(a: unknown[], b: unknown[]): DiffNode {
  const len = Math.max(a.length, b.length);
  const items: DiffNode[] = [];
  for (let i = 0; i < len; i++) items.push(diffJson(a[i], b[i]));
  return { kind: "array", items };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
