import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import { useRepository } from "../state/RepositoryContext";
import type { GitHistory } from "../types";

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

// Only show every Nth label on the x-axis so it doesn't crowd
function tickFormatter(value: string, index: number, total: number): string {
  if (total <= 10) return value;
  const step = Math.ceil(total / 10);
  return index % step === 0 ? value.slice(5) : ""; // show MM-DD
}

export function GitHistoryPage() {
  const { selected } = useRepository();
  const [data, setData] = useState<GitHistory | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 50;

  useEffect(() => {
    if (!selected) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getGitHistory(selected.id, page, pageSize)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Load failed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected, page]);

  if (!selected) {
    return <div className="card text-sm text-content-muted">Select a repository to view its Git history.</div>;
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total_commits / pageSize)) : 1;

  // Thin the commits-over-time to a max of 90 points for chart readability
  const chartData = (() => {
    if (!data?.commits_over_time) return [];
    const pts = data.commits_over_time;
    if (pts.length <= 90) return pts;
    // sample every N-th point
    const step = Math.ceil(pts.length / 90);
    return pts.filter((_, i) => i % step === 0);
  })();

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Git History</h1>
          <p className="mt-1 text-sm text-content-muted">
            {data ? `${data.total_commits.toLocaleString()} commits` : "Loading…"}
          </p>
        </div>
      </div>

      {error && (
        <div className="card border-risk-high/30 bg-risk-high/10 text-sm text-risk-high">{error}</div>
      )}

      {/* Commits over time chart */}
      {chartData.length > 0 && (
        <div className="card">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-content-faint">
            Commits over time
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(34 41 54)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgb(100 112 130)", fontSize: 10 }}
                tickFormatter={(v, i) => tickFormatter(v, i, chartData.length)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgb(100 112 130)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "rgb(19 23 31)",
                  border: "1px solid rgb(48 57 73)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "rgb(233 238 245)" }}
                itemStyle={{ color: "rgb(226 100 112)" }}
              />
              <Bar dataKey="count" fill="rgb(226 100 112)" radius={[2, 2, 0, 0]} maxBarSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top changed files */}
        {data?.top_changed_files && data.top_changed_files.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border bg-bg-soft px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-content-faint">
                Most changed files
              </p>
            </div>
            <ul className="divide-y divide-border/60">
              {data.top_changed_files.slice(0, 10).map((f) => (
                <li key={f.path} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-bg-elevated">
                  <div className="min-w-0">
                    {f.file_id ? (
                      <Link
                        to={`/file/${encodeURIComponent(f.path)}?fileId=${f.file_id}`}
                        className="block truncate font-mono text-xs text-accent hover:underline"
                      >
                        {f.path}
                      </Link>
                    ) : (
                      <span className="block truncate font-mono text-xs text-content-muted">{f.path}</span>
                    )}
                    <span className="text-[11px] text-content-faint">
                      +{f.total_insertions.toLocaleString()} / -{f.total_deletions.toLocaleString()}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                    {f.change_count}×
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Contributors */}
        {data?.contributors && data.contributors.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border bg-bg-soft px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-content-faint">
                Contributors
              </p>
            </div>
            <ul className="divide-y divide-border/60">
              {data.contributors.map((c) => {
                const maxCommits = data.contributors[0]?.commit_count ?? 1;
                const pct = Math.round((c.commit_count / maxCommits) * 100);
                return (
                  <li key={c.login} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-content">{c.login}</span>
                        <span className="text-xs text-content-faint">{c.commit_count}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-soft">
                        <div
                          className="h-full rounded-full bg-accent/60"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Commit list */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border bg-bg-soft px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-content-faint">
            Commits
          </p>
        </div>
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-content-faint">Loading…</p>
        ) : data?.commits.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-content-faint">
            No commits. Analyse the repository first.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {data?.commits.map((c) => (
              <li key={c.sha} className="flex items-start gap-4 px-4 py-3 hover:bg-bg-elevated">
                <span className="shrink-0 font-mono text-xs text-content-faint pt-0.5">
                  {shortSha(c.sha)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-content">
                    {c.message ?? "(no message)"}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-content-faint">
                    <span>{c.author_name ?? "unknown"}</span>
                    <span>·</span>
                    <span>{relTime(c.committed_at)}</span>
                    {c.files_changed > 0 && (
                      <>
                        <span>·</span>
                        <span>{c.files_changed} file{c.files_changed !== 1 ? "s" : ""}</span>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Prev
          </button>
          <span className="text-xs text-content-faint">{page} / {totalPages}</span>
          <button className="btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
