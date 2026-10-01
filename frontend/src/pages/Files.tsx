import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useRepository } from "../state/RepositoryContext";
import type { PaginatedFiles } from "../types";

const LANG_BADGE: Record<string, string> = {
  python: "bg-blue-900/40 text-blue-300",
  typescript: "bg-sky-900/40 text-sky-300",
  javascript: "bg-yellow-900/40 text-yellow-300",
  go: "bg-cyan-900/40 text-cyan-300",
  rust: "bg-orange-900/40 text-orange-300",
};

export function Files() {
  const { selected } = useRepository();
  const [data, setData] = useState<PaginatedFiles | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const pageSize = 50;

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoading(true);
    api
      .listFiles(selected.id, page, pageSize, search || undefined)
      .then((d) => { if (!cancelled) setData(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected, page, search]);

  if (!selected) {
    return (
      <div className="card">
        <p className="text-sm text-content-muted">Select a repository to browse its files.</p>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Files</h1>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-xs text-content-faint">
              {data.total.toLocaleString()} files
            </span>
          )}
          <input
            className="input w-64"
            placeholder="Filter by path…"
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-soft">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-faint">
                Path
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-faint">
                Language
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-content-faint">
                Lines
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-content-faint">
                Type
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {data?.items.map((f) => (
              <tr key={f.id} className="group transition-colors hover:bg-bg-elevated">
                <td className="px-4 py-2.5">
                  <Link
                    className="font-mono text-xs text-accent transition-colors hover:underline"
                    to={`/file/${encodeURIComponent(f.path)}?fileId=${f.id}`}
                  >
                    {f.path}
                  </Link>
                  {f.parse_error && (
                    <span
                      className="ml-2 rounded bg-risk-medium/15 px-1 py-0.5 text-[10px] text-risk-medium"
                      title={f.parse_error}
                    >
                      parse warning
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {f.language ? (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        LANG_BADGE[f.language] ?? "bg-bg-soft text-content-faint"
                      }`}
                    >
                      {f.language}
                    </span>
                  ) : (
                    <span className="text-content-faint">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-content-muted">
                  {f.loc.toLocaleString()}
                </td>
                <td className="px-4 py-2.5">
                  {f.is_test ? (
                    <span className="rounded bg-sage/15 px-1.5 py-0.5 text-[11px] font-medium text-sage">
                      test
                    </span>
                  ) : (
                    <span className="text-xs text-content-faint">source</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && data && data.items.length === 0 && (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-content-faint" colSpan={4}>
                  {search
                    ? `No files matching "${search}"`
                    : "No files yet. Analyse the repository first."}
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="px-4 py-10 text-center text-sm text-content-faint" colSpan={4}>
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button
            className="btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span className="text-xs text-content-faint">
            {page} / {totalPages}
          </span>
          <button
            className="btn-ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
