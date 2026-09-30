import { useEffect, useState } from "react";
import { getHealth, type HealthResponse } from "./api";

type HealthState =
  | { kind: "loading" }
  | { kind: "ok"; data: HealthResponse }
  | { kind: "error"; message: string };

function App() {
  const [health, setHealth] = useState<HealthState>({ kind: "loading" });

  useEffect(() => {
    getHealth()
      .then((data) => setHealth({ kind: "ok", data }))
      .catch((err: unknown) =>
        setHealth({
          kind: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        }),
      );
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-slate-800">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
          W
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">
          Refund System
        </h1>
      </div>

      <p className="text-lg text-slate-500">
        AI-powered customer support &mdash; coming soon.
      </p>

      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-medium text-slate-500">
          Backend health
        </h2>
        {health.kind === "loading" && (
          <p className="text-sm text-slate-400">Checking&hellip;</p>
        )}
        {health.kind === "ok" && (
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {health.data.status}
            </span>
            <span className="text-slate-400">
              provider: <code>{health.data.provider}</code>
            </span>
          </div>
        )}
        {health.kind === "error" && (
          <p className="text-sm font-medium text-red-600">{health.message}</p>
        )}
      </div>
    </main>
  );
}

export default App;
