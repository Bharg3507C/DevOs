import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { StatCard } from "../components/StatCard";
import { useRepository } from "../state/RepositoryContext";
import type { FileDetail } from "../types";

function complexityColor(cc: number) {
  if (cc >= 10) return "text-risk-high";
  if (cc >= 5) return "text-risk-medium";
  return "text-risk-low";
}

function buildConcerns(d: FileDetail): string[] {
  const c: string[] = [];
  if (d.dependents_count >= 10)
    c.push(`${d.dependents_count} internal modules depend on this file — changes have wide reach.`);
  if (d.max_complexity >= 10)
    c.push(`Highest function complexity is ${d.max_complexity} (cyclomatic). Consider refactoring.`);
  if (!d.is_test && d.functions.length > 0 && d.dependents_count === 0)
    c.push("No internal dependents detected — this module may be unused or an entry point.");
  return c;
}

export function FileDetailPage() {
  const { selected } = useRepository();
  const [params] = useSearchParams();
  const fileId = params.get("fileId");
  const [detail, setDetail] = useState<FileDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected || !fileId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getFileDetail(selected.id, Number(fileId))
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Load failed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected, fileId]);

  if (!selected) return <div className="card text-sm text-content-muted">Select a repository first.</div>;
  if (!fileId) return <div className="card text-sm text-content-muted">No file specified.</div>;
  if (loading) return (
    <div className="flex items-center gap-2 p-4 text-sm text-content-faint">
      <span className="animate-spin">⟳</span> Loading file intelligence…
    </div>
  );
  if (error) return (
    <div className="card border-risk-high/30 bg-risk-high/10 text-sm text-risk-high">{error}</div>
  );
  if (!detail) return null;

  const concerns = buildConcerns(detail);

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-content-faint">
        <Link to="/files" className="hover:text-content-muted transition-colors">
          Files
        </Link>
        <span>/</span>
        <span className="text-content">{detail.path.split("/").pop()}</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="font-mono text-lg font-semibold leading-tight">{detail.path}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-content-faint">
          {detail.language && (
            <span className="rounded bg-bg-soft px-2 py-0.5 font-medium">
              {detail.language}
            </span>
          )}
          {detail.is_test && (
            <span className="rounded bg-sage/15 px-2 py-0.5 font-medium text-sage">
              test file
            </span>
          )}
          <span>{detail.size_bytes.toLocaleString()} bytes</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Lines" value={detail.loc.toLocaleString()} />
        <StatCard label="Functions" value={detail.functions.length} />
        <StatCard label="Classes" value={detail.classes.length} />
        <StatCard label="Dependents" value={detail.dependents_count} accent={detail.dependents_count >= 10} />
        <StatCard label="Max complexity" value={detail.max_complexity} accent={detail.max_complexity >= 10} />
      </div>

      {/* Concerns */}
      {concerns.length > 0 && (
        <div className="card border-risk-medium/30 bg-risk-medium/[0.05]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-risk-medium">
            Potential concerns
          </p>
          <ul className="space-y-2">
            {concerns.map((c) => (
              <li key={c} className="flex gap-2 text-sm text-content-muted">
                <span className="mt-0.5 shrink-0 text-risk-medium">△</span>
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-content-faint">
            Structural observations from parsed metrics — not security findings.
          </p>
        </div>
      )}

      {/* Parse error */}
      {detail.parse_error && (
        <div className="card border-risk-high/30 bg-risk-high/[0.05]">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-risk-medium">
            Parse warning
          </p>
          <p className="font-mono text-xs text-content-muted">{detail.parse_error}</p>
        </div>
      )}

      {/* Symbols */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SymbolTable
          title="Functions"
          empty="No functions detected."
          rows={detail.functions.map((f) => ({
            key: f.qualified_name ?? f.name,
            primary: f.qualified_name ?? f.name,
            badges: [
              f.is_async ? "async" : "",
              f.is_method ? "method" : "",
              f.is_test ? "test" : "",
            ].filter(Boolean),
            meta: `L${f.start_line}–${f.end_line} · ${f.loc} lines · ${f.num_params} params`,
            cc: f.cyclomatic_complexity,
          }))}
        />
        <SymbolTable
          title="Classes"
          empty="No classes detected."
          rows={detail.classes.map((c) => ({
            key: c.name,
            primary: c.name,
            badges: c.base_classes?.length ? [`extends ${c.base_classes.join(", ")}`] : [],
            meta: `L${c.start_line}–${c.end_line} · ${c.num_methods} methods`,
            cc: null,
          }))}
        />
      </div>

      <SymbolTable
        title="Imports"
        empty="No imports."
        rows={detail.imports.map((i, idx) => ({
          key: `${i.module}-${idx}`,
          primary: i.symbol ? `${i.module}.${i.symbol}` : i.module,
          badges: i.is_relative ? ["relative"] : [],
          meta: `line ${i.line}`,
          cc: null,
        }))}
      />
    </div>
  );
}

interface SymbolRow {
  key: string;
  primary: string;
  badges: string[];
  meta: string;
  cc: number | null;
}

function SymbolTable({ title, rows, empty }: { title: string; rows: SymbolRow[]; empty: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="border-b border-border bg-bg-soft px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-content-faint">
          {title}{" "}
          <span className="ml-1 text-content-muted">{rows.length}</span>
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-content-faint">{empty}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((r) => (
            <li
              key={r.key}
              className="flex items-start justify-between gap-2 px-4 py-2.5 hover:bg-bg-elevated"
            >
              <div className="min-w-0">
                <span className="block truncate font-mono text-xs text-content">
                  {r.primary}
                </span>
                <span className="mt-0.5 block text-[11px] text-content-faint">
                  {r.meta}
                </span>
                {r.badges.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.badges.map((b) => (
                      <span
                        key={b}
                        className="rounded bg-bg-soft px-1.5 py-0.5 text-[10px] text-content-faint"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {r.cc !== null && (
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-medium ${complexityColor(r.cc)} bg-current/10`}
                  title="cyclomatic complexity"
                >
                  cc {r.cc}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
