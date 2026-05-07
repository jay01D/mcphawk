export function App() {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-800 px-6 py-3 text-sm">
        <span className="font-mono font-semibold tracking-tight">mcptrace</span>
        <span className="ml-3 text-slate-400">live timeline</span>
      </header>
      <main className="flex-1 overflow-hidden p-6 text-slate-400">
        Timeline will live here.
      </main>
    </div>
  );
}
