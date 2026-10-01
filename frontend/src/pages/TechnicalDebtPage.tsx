import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useRepository } from "../state/RepositoryContext";
import type { DebtFinding, TechnicalDebt } from "../types";

// ---- Severity badge --------------------------------------------------------

function SeverityBadge({ severity }: { severity: DebtFinding["severity"] }) {
  const styles: Record<string, string> = {
    high:   "bg-risk-high/15 text-risk-high",
    medium: "bg-risk-medium/15 text-risk-medium",
    low:    "bg-risk-low/15 text-risk-low",
    info:   "bg-bg-elevated text-content-faint",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${styles[severity] ?? styles.info}`}>
      {severity}
    </span>
  );
}

// ---- Score bar -------------------------------------------------------------

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, score);
  const color =
    score >= 60 ? "bg-risk-high" : score >= 30 ? "bg-risk-medium" : "bg-risk-low";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-soft">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---- Finding row -----------------------------------------------------------

function FindingRow({ finding }: { finding: DebtFinding }) {
  const [expanded, setExpanded] = useState(false);
  const filename = finding.path?.split("/").pop() ?? "—";

  return (
    <li className="border-b border-border/60 last:border-0">
      <button
        className="w-full px-4 py-3.5 text-left hover:bg-bg-elevated transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start gap-3">
          <SeverityBadge severity={finding.severity} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              {finding.file_id && finding.path ? (
                <Link
                  to={`/file/${encodeURIComponent(finding.path)}?fileId=${finding.file_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="truncate font-mono text-xs text-accent hover:underline"
                  title={finding.path}
                >
                  {finding.path}
                </Link>
              ) : (
                <span className="font-mono text-xs text-content-muted">{finding.path ?? "—"}</span>
              )}
              <span className="shrink-0 text-xs font-medium text-content-faint">
                {finding.score.toFixed(0)} / 100
              </span>
            </div>
            <div className="mt-1.5">
              <ScoreBar score={finding.score} />
            </div>
            {!expanded && (
              <p className="mt-1.5 text-xs text-content-faint line-clamp-1">
                {finding.reasons[0]}
                {finding.reasons.length > 1 ? ` +${finding.reasons.length - 1} more` : ""}
              </p>
            )}
          </div>
          <span className="shrink-0 text-xs text-content-faint">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/40 bg-bg-soft/40 px-4 py-3 space-y-3">
          <div>
            <p className="mb-2 text-xs font-medium text-content-faint">Reasons</p>
            <ul className="space-y-1.5">
              {finding.reasons.map((r) => (
                <li key={r} className="flex gap-2 text-xs text-content-muted">
                  <span className="shrink-0 text-risk-medium mt-0.5">△</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
          {finding.signals && Object.keys(finding.signals).length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-content-faint">Raw signals</p>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                {Object.entries(finding.signals).map(([k, v]) => (
                  <>
                    <dt key={`${k}-k`} className="text-content-faint">{k.replace(/_/g, " ")}</dt>
                    <dd key={`${k}-v`} className="font-medium text-content">{String(v)}</dd>
                  </>
                ))}
              </dl>
            </div>
          )}
          <p className="text-[11px] text-content-faint">
            Score = sum of matched signal weights. See ARCHITECTURE.md for methodology.
          </p>
        </div>
      )}
    </li>
  );
}

// ---- Main component --------------------------------------------------------

export function TechnicalDebtPage() {
  const { selected } = useRepository();
  const [data, setData] = useState<TechnicalDebt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DebtFinding["severity"] | "all">("all");

  useEffect(() => {
    if (!selected) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getTechnicalDebt(selected.id)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Load failed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  if (!selected) {
    return <div className="card text-sm text-content-muted">Select a repository first.</div>;
  }

  const filtered =
    filter === "all"
      ? (data?.findings ?? [])
      : (data?.findings ?? []).filter((f) => f.severity === filter);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Technical Debt</h1>
        <p className="mt-1 text-sm text-content-muted">
          Every finding is derived from transparent, deterministic signals — no opaque AI scores.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-content-faint">
          <span className="animate-spin">⟳</span> Calculating…
        </div>
      )}
      {error && (
        <div className="card border-risk-high/30 bg-risk-high/10 text-sm text-risk-high">{error}</div>
      )}

      {data && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total findings", value: data.total_findings, accent: false },
              { label: "High attention",  value: data.high_count,    accent: data.high_count > 0,    color: "text-risk-high" },
              { label: "Medium",          value: data.medium_count,  accent: data.medium_count > 0,  color: "text-risk-medium" },
              { label: "Low",             value: data.low_count,     accent: false,                   color: "text-risk-low" },
            ].map(({ label, value, accent, color }) => (
              <div key={label} className={`card flex flex-col gap-1 ${accent ? "border-accent/30" : ""}`}>
                <p className="eyebrow">{label}</p>
                <p className={`text-2xl font-semibold tabular-nums ${color ?? "text-content"}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Methodology note */}
          <div className="rounded-lg border border-border bg-bg-soft/40 px-4 py-3 text-xs text-content-faint">
            <strong className="text-content-muted">How scores are calculated:</strong>{" "}
            High complexity (+25) · Many dependents (+20) · High churn (+20) · No tests (+15) ·
            Many functions (+10) · Large file (+10). Score ≥ 60 = high, ≥ 30 = medium, ≥ 10 = low.
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2">
            {(["all", "high", "medium", "low"] as const).map((s) => (
              <button
                key={s}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === s
                    ? "bg-accent/15 text-accent"
                    : "text-content-faint hover:bg-bg-elevated hover:text-content"
                }`}
                onClick={() => setFilter(s)}
              >
                {s === "all" ? `All (${data.total_findings})` : `${s} (${data[`${s}_count` as "high_count" | "medium_count" | "low_count"]})`}
              </button>
            ))}
          </div>

          {/* Findings list */}
          {filtered.length === 0 ? (
            <div className="card text-center text-sm text-content-faint py-10">
              No {filter === "all" ? "" : filter} findings.{" "}
              {data.total_findings === 0 ? "Run an analysis first." : ""}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <ul>
                {filtered.map((f) => (
                  <FindingRow key={f.file_id ?? f.path ?? Math.random()} finding={f} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
