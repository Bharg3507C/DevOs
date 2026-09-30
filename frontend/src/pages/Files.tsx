import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useRepository } from "../state/RepositoryContext";
import type { PaginatedFiles } from "../types";

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
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, page, search]);

  if (!selected)
    return <div className="card">Select a repository to browse its files.</div>;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Files</h1>
        <input
          className="input w-64"
          placeholder="Filter by path…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
      </div>

      <div className="card p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-slate-500">
              <th className="px-3 py-2">Path</th>
              <th className="px-3 py-2">Language</th>
              <th className="px-3 py-2 text-right">LOC</th>
              <th className="px-3 py-2">Type</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((f) => (
              <tr
                key={f.id}
                className="border-b border-border/60 hover:bg-bg-soft"
              >
                <td className="px-3 py-2 font-mono">
                  <Link
                    className="text-accent hover:underline"
                    to={`/file/${encodeURIComponent(f.path)}?fileId=${f.id}`}
                  >
                    {f.path}
                  </Link>
                  {f.parse_error ? (
                    <span
                      className="ml-2 text-xs text-risk-medium"
                      title={f.parse_error}
                    >
                      parse warning
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-slate-400">{f.language ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{f.loc}</td>
                <td className="px-3 py-2 text-slate-400">
                  {f.is_test ? "test" : "source"}
                </td>
              </tr>
            ))}
            {!loading && data && data.items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={4}>
                  No files. Analyse the repository first.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{data ? `${data.total} files` : ""}</span>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            className="btn-ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
