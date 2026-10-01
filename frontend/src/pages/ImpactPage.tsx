import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useRepository } from "../state/RepositoryContext";
import type { FileSummary, ImpactNode, ImpactResponse, PaginatedFiles } from "../types";

// ---- File picker -----------------------------------------------------------

function FilePicker({
  repoId,
  onSelect,
}: {
  repoId: number;
  onSelect: (file: FileSummary) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PaginatedFiles | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!search.trim()) { setResults(null); return; }
    let cancelled = false;
    setBusy(true);
    api.listFiles(repoId, 1, 15, search.trim())
      .then((d) => { if (!cancelled) setResults(d); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [repoId, search]);

  return (
    <div className="space-y-2">
      <input
        className="input w-full"
        placeholder="Search for a file…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {busy && <p className="text-xs text-content-faint">Searching…</p>}
      {results && results.items.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-border">
          {results.items.map((f) => (
            <li key={f.id}>
              <button
                className="w-full px-4 py-2.5 text-left font-mono text-xs text-content hover:bg-bg-elevated transition-colors"
                onClick={() => { onSelect(f); setSearch(""); setResults(null); }}
              >
                {f.path}
              </button>
            </li>
          ))}
        </ul>
      )}
      {results && results.items.length === 0 && (
        <p className="text-xs text-content-faint">No matching files.</p>
      )}
    </div>
  );
}

// ---- Impact tree visualisation ---------------------------------------------

function kindBadge(kind: ImpactNode["kind"]) {
  if (kind === "direct")   return "bg-accent/15 text-accent";
  if (kind === "indirect") return "bg-highlight/10 text-blue-300";
  return "bg-sage/15 text-sage";
}

function DepChain({ impact }: { impact: ImpactResponse }) {
  // Group nodes by distance for a layered display
  const byDistance: Record<number, ImpactNode[]> = {};
  for (const n of impact.nodes) {
    (byDistance[n.distance] ??= []).push(n);
  }
  const maxDist = Math.max(...Object.keys(byDistance).map(Number), 0);

  return (
    <div className="space-y-3">
      {/* Origin */}
      <div className="flex items-center gap-2">
        <span className="rounded bg-bg-elevated px-2 py-1 font-mono text-xs text-content">
          {impact.origin_path}
        </span>
        <span className="text-xs text-content-faint">(origin)</span>
      </div>

      {Array.from({ length: maxDist }, (_, i) => i + 1).map((dist) => {
        const nodes = byDistance[dist] ?? [];
        return (
          <div key={dist} className="pl-4 border-l border-border space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-content-faint mb-2">
              {dist === 1 ? "Direct dependents" : `Indirect — depth ${dist}`}
            </p>
            {nodes.map((n) => (
              <div key={n.file_id} className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${kindBadge(n.kind)}`}>
                  {n.kind}
                </span>
                <Link
                  to={`/file/${encodeURIComponent(n.path)}?fileId=${n.file_id}`}
                  className="font-mono text-xs text-content hover:text-accent transition-colors"
                >
                  {n.path}
                </Link>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ---- Main component --------------------------------------------------------

export function ImpactPage() {
  const { selected } = useRepository();
  const [selectedFile, setSelectedFile] = useState<FileSummary | null>(null);
  const [impact, setImpact] = useState<ImpactResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected || !selectedFile) { setImpact(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getImpact(selected.id, selectedFile.id)
      .then((d) => { if (!cancelled) setImpact(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Load failed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected, selectedFile]);

  if (!selected) {
    return <div className="card text-sm text-content-muted">Select a repository first.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Change Impact</h1>
        <p className="mt-1 text-sm text-content-muted">
          Select a file to see what would be affected if it changed.
          Uses BFS over the reverse dependency graph.
        </p>
      </div>

      {/* File picker */}
      <div className="card">
        <p className="mb-3 text-sm font-medium">Select origin file</p>
        <FilePicker repoId={selected.id} onSelect={(f) => { setSelectedFile(f); setImpact(null); }} />
        {selectedFile && (
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded bg-accent/15 px-2 py-1 font-mono text-xs text-accent">
              {selectedFile.path}
            </span>
            <button
              className="text-xs text-content-faint hover:text-risk-high transition-colors"
              onClick={() => { setSelectedFile(null); setImpact(null); }}
            >
              ✕ clear
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-content-faint">
          <span className="animate-spin">⟳</span> Traversing dependency graph…
        </div>
      )}
      {error && (
        <div className="card border-risk-high/30 bg-risk-high/10 text-sm text-risk-high">{error}</div>
      )}

      {impact && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Directly affected",   value: impact.directly_affected,   accent: impact.directly_affected > 5 },
              { label: "Indirectly affected", value: impact.indirectly_affected, accent: impact.indirectly_affected > 10 },
              { label: "Related tests",       value: impact.related_tests,       accent: false },
              { label: "Total reachable",     value: impact.nodes.length,        accent: false },
            ].map(({ label, value, accent }) => (
              <div key={label} className={`card flex flex-col gap-1 ${accent ? "border-accent/40 bg-accent/[0.06]" : ""}`}>
                <p className="eyebrow">{label}</p>
                <p className={`text-2xl font-semibold tabular-nums ${accent ? "text-accent" : "text-content"}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {impact.nodes.length === 0 ? (
            <div className="card text-sm text-content-muted">
              No dependents found. This file may be an entry point or is not imported by other modules.
            </div>
          ) : (
            <div className="card">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-content-faint">
                Dependency chain
              </p>
              <DepChain impact={impact} />
            </div>
          )}
        </>
      )}

      {!selectedFile && !loading && (
        <div className="card border-dashed text-center text-sm text-content-faint py-10">
          Search for a file above to start an impact analysis.
        </div>
      )}
    </div>
  );
}
