import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import { StatCard } from "../components/StatCard";
import { useRepository } from "../state/RepositoryContext";
import type { Overview } from "../types";
import type { OutletContext } from "../components/Layout";

export function Dashboard() {
  const { selected } = useRepository();
  const { lastCompletedJobId } = useOutletContext<OutletContext>();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selected) {
      setOverview(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getOverview(selected.id)
      .then((o) => {
        if (!cancelled) setOverview(o);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, lastCompletedJobId]);

  if (!selected) {
    return (
      <div className="card max-w-2xl">
        <h1 className="text-lg font-semibold">No repository selected</h1>
        <p className="mt-2 text-sm text-slate-400">
          Connect a repository from the Repository page to get started.
        </p>
      </div>
    );
  }

  const notAnalysed = overview && overview.last_analysed_at == null;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">{selected.full_name}</h1>
        {overview?.last_analysed_at ? (
          <span className="text-xs text-slate-500">
            Analysed {new Date(overview.last_analysed_at).toLocaleString()}
          </span>
        ) : null}
      </div>

      {notAnalysed ? (
        <div className="card">
          <p className="text-sm text-slate-400">
            This repository has not been analysed yet. Click{" "}
            <span className="text-slate-200">Analyse Repository</span> above to
            build its knowledge graph.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Files" value={overview?.total_files ?? "—"} />
          <StatCard label="Functions" value={overview?.total_functions ?? "—"} />
          <StatCard label="Classes" value={overview?.total_classes ?? "—"} />
          <StatCard
            label="Dependencies"
            value={overview?.total_dependencies ?? "—"}
          />
          <StatCard label="Tests" value={overview?.total_tests ?? "—"} />
          <StatCard
            label="Avg complexity"
            value={overview ? overview.average_complexity.toFixed(1) : "—"}
          />
        </div>
      )}

      {loading ? <div className="text-sm text-slate-500">Loading…</div> : null}

      {overview && Object.keys(overview.languages).length > 0 ? (
        <div className="card">
          <h2 className="mb-2 text-sm font-medium">Languages</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(overview.languages)
              .sort((a, b) => b[1] - a[1])
              .map(([lang, bytes]) => (
                <span
                  key={lang}
                  className="rounded bg-bg-soft px-2 py-1 text-xs text-slate-300"
                >
                  {lang}
                  <span className="ml-1 text-slate-500">
                    {Math.round(bytes / 1024)}k
                  </span>
                </span>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
