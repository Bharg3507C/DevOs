import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { StatCard } from "../components/StatCard";
import { useRepository } from "../state/RepositoryContext";
import type { FileDetail } from "../types";

// File intelligence view. Every "potential concern" is derived from real
// metrics (dependent count, change data) and phrased cautiously, never as a
// vulnerability claim.
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
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, fileId]);

  if (!selected) return <div className="card">Select a repository first.</div>;
  if (!fileId) return <div className="card">No file specified.</div>;
  if (loading) return <div className="text-sm text-slate-500">Loading…</div>;
  if (error) return <div className="card text-risk-high">{error}</div>;
  if (!detail) return null;

  const concerns = buildConcerns(detail);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-mono text-lg font-semibold">{detail.path}</h1>
        <div className="text-xs text-slate-500">
          {detail.language ?? "unknown"} · {detail.is_test ? "test file" : "source"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Lines" value={detail.loc} />
        <StatCard label="Functions" value={detail.functions.length} />
        <StatCard label="Classes" value={detail.classes.length} />
        <StatCard label="Dependents" value={detail.dependents_count} />
        <StatCard label="Max complexity" value={detail.max_complexity} />
      </div>

      {concerns.length > 0 ? (
        <div className="card">
          <h2 className="mb-2 text-sm font-medium">Potential concerns</h2>
          <ul className="space-y-1 text-sm text-slate-400">
            {concerns.map((c) => (
              <li key={c}>· {c}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-600">
            These are structural observations derived from parsed metrics, not
            security findings.
          </p>
        </div>
      ) : null}

      {detail.parse_error ? (
        <div className="card border-risk-medium/40">
          <h2 className="text-sm font-medium text-risk-medium">Parse warning</h2>
          <p className="mt-1 font-mono text-xs text-slate-400">
            {detail.parse_error}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SymbolList
          title="Functions"
          empty="No functions parsed."
          rows={detail.functions.map((f) => ({
            key: f.qualified_name ?? f.name,
            primary: f.qualified_name ?? f.name,
            meta: `L${f.start_line}–${f.end_line} · cc ${f.cyclomatic_complexity} · ${f.num_params} params${f.is_test ? " · test" : ""}`,
          }))}
        />
        <SymbolList
          title="Classes"
          empty="No classes parsed."
          rows={detail.classes.map((c) => ({
            key: c.name,
            primary: c.name,
            meta: `L${c.start_line}–${c.end_line} · ${c.num_methods} methods${
              c.base_classes && c.base_classes.length
                ? ` · extends ${c.base_classes.join(", ")}`
                : ""
            }`,
          }))}
        />
      </div>

      <SymbolList
        title="Imports"
        empty="No imports."
        rows={detail.imports.map((i, idx) => ({
          key: `${i.module}-${i.symbol ?? ""}-${idx}`,
          primary: i.symbol ? `${i.module} → ${i.symbol}` : i.module,
          meta: `L${i.line}${i.is_relative ? " · relative" : ""}`,
        }))}
      />
    </div>
  );
}

function buildConcerns(d: FileDetail): string[] {
  const concerns: string[] = [];
  if (d.dependents_count >= 10)
    concerns.push(
      `This module has ${d.dependents_count} dependents; changes here have wide reach.`,
    );
  if (d.max_complexity >= 10)
    concerns.push(
      `Contains a function with cyclomatic complexity ${d.max_complexity}.`,
    );
  if (!d.is_test && d.functions.length > 0 && d.dependents_count === 0)
    concerns.push("No internal dependents were detected for this module.");
  return concerns;
}

interface SymbolRow {
  key: string;
  primary: string;
  meta: string;
}

function SymbolList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: SymbolRow[];
  empty: string;
}) {
  return (
    <div className="card">
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.key} className="text-sm">
              <span className="font-mono text-slate-200">{r.primary}</span>
              <span className="ml-2 text-xs text-slate-500">{r.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
