import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "../api/client";
import { StatCard } from "../components/StatCard";
import { useRepository } from "../state/RepositoryContext";
import type { Overview } from "../types";
import type { OutletContext } from "../components/Layout";

// Very rough "size" formatter for language byte counts.
function fmtBytes(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

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
      .then((o) => { if (!cancelled) setOverview(o); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected, lastCompletedJobId]);

  if (!selected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-accent/10 text-3xl">
          ⬡
        </div>
        <div>
          <h2 className="text-xl font-semibold">No repository connected</h2>
          <p className="mt-2 max-w-sm text-sm text-content-muted">
            Connect a GitHub or GitLab repository to start building your
            codebase knowledge graph.
          </p>
        </div>
        <Link to="/repository" className="btn-primary">
          Connect a repository
        </Link>
      </div>
    );
  }

  const notAnalysed = overview && overview.last_analysed_at == null;
  const langs = Object.entries(overview?.languages ?? {}).sort((a, b) => b[1] - a[1]);
  const totalBytes = langs.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {selected.full_name}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-xs text-content-faint">
            <span>{selected.default_branch}</span>
            {selected.is_private && (
              <span className="rounded border border-border px-1.5 py-0.5">
                private
              </span>
            )}
            {overview?.last_analysed_at ? (
              <span>
                Analysed{" "}
                {new Date(overview.last_analysed_at).toLocaleDateString(undefined, {
                  dateStyle: "medium",
                })}
              </span>
            ) : null}
          </div>
        </div>
        {overview?.last_commit_sha && (
          <span className="font-mono text-xs text-content-faint">
            {overview.last_commit_sha.slice(0, 7)}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-content-faint">
          <span className="animate-spin">⟳</span> Loading…
        </div>
      )}

      {notAnalysed ? (
        <div className="card flex flex-col gap-3 border-accent/30 bg-accent/[0.05]">
          <p className="text-sm font-medium">Ready to analyse</p>
          <p className="text-sm text-content-muted">
            Click{" "}
            <span className="font-medium text-content">Analyse Repository</span>{" "}
            above to build the knowledge graph. DevOS will parse your files
            statically, resolve dependencies, and read Git history.
          </p>
        </div>
      ) : overview ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Files" value={overview.total_files.toLocaleString()} />
            <StatCard label="Functions" value={overview.total_functions.toLocaleString()} />
            <StatCard label="Classes" value={overview.total_classes.toLocaleString()} />
            <StatCard label="Dependencies" value={overview.total_dependencies.toLocaleString()} />
            <StatCard label="Test files" value={overview.total_tests.toLocaleString()} />
            <StatCard
              label="Avg complexity"
              value={overview.average_complexity.toFixed(1)}
              hint="cyclomatic"
              accent={overview.average_complexity >= 5}
            />
          </div>

          {langs.length > 0 && (
            <div className="card">
              <p className="mb-3 text-xs font-medium text-content-muted uppercase tracking-wide">
                Languages
              </p>
              {/* Stacked bar */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg-soft">
                {langs.map(([lang, bytes], i) => {
                  const pct = totalBytes ? (bytes / totalBytes) * 100 : 0;
                  const hues = [0, 163, 200, 270, 30, 120];
                  const h = hues[i % hues.length];
                  return (
                    <div
                      key={lang}
                      className="inline-block h-full"
                      style={{ width: `${pct}%`, backgroundColor: `hsl(${h},60%,58%)` }}
                    />
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {langs.slice(0, 8).map(([lang, bytes], i) => {
                  const hues = [0, 163, 200, 270, 30, 120];
                  const h = hues[i % hues.length];
                  return (
                    <div key={lang} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: `hsl(${h},60%,58%)` }}
                      />
                      <span className="text-content">{lang}</span>
                      <span className="text-content-faint">{fmtBytes(bytes)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
