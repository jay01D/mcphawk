type Props = { state: "connecting" | "open" | "closed" };

export function ConnectionBadge({ state }: Props) {
  const styles: Record<Props["state"], string> = {
    connecting: "bg-amber-900/40 text-amber-300",
    open: "bg-emerald-900/40 text-emerald-300",
    closed: "bg-rose-900/40 text-rose-300",
  };
  const labels: Record<Props["state"], string> = {
    connecting: "connecting",
    open: "live",
    closed: "offline",
  };
  return (
    <span className={`ml-3 rounded px-2 py-0.5 text-xs ${styles[state]}`}>
      {labels[state]}
    </span>
  );
}
