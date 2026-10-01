import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useRepository } from "../state/RepositoryContext";
import type { SearchResponse, SearchResult } from "../types";

// ---- Kind badge ------------------------------------------------------------

const KIND_STYLES: Record<string, string> = {
  file:     "bg-bg-elevated text-content-faint",
  function: "bg-accent/15 text-accent",
  method:   "bg-accent/15 text-accent",
  class:    "bg-blue-900/40 text-blue-300",
  import:   "bg-sage/15 text-sage",
};

function KindBadge({ kind }: { kind: SearchResult["kind"] }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${KIND_STYLES[kind] ?? KIND_STYLES.file}`}>
      {kind}
    </span>
  );
}

// ---- Result card -----------------------------------------------------------

function ResultCard({ result, query }: { result: SearchResult; query: string }) {
  // Highlight matching fragment in the path/symbol
  function highlight(text: string) {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-accent/30 text-content rounded-sm px-0.5">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  }

  return (
    <li className="border-b border-border/60 last:border-0">
      <div className="flex items-start gap-3 px-4 py-3.5 hover:bg-bg-elevated transition-colors">
        <KindBadge kind={result.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {/* File path — always linkable */}
              <Link
                to={`/file/${encodeURIComponent(result.path)}?fileId=${result.file_id}`}
                className="truncate font-mono text-xs text-accent hover:underline"
                title={result.path}
              >
                {highlight(result.path)}
              </Link>
              {/* Symbol name (for functions / classes) */}
              {result.symbol && (
                <p className="mt-0.5 font-mono text-xs text-content">
                  {highlight(result.symbol)}
                </p>
              )}
            </div>
            {result.start_line != null && (
              <span className="shrink-0 text-xs text-content-faint">
                L{result.start_line}
                {result.end_line && result.end_line !== result.start_line
                  ? `–${result.end_line}`
                  : ""}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-content-faint">{result.match_reason}</p>
        </div>
      </div>
    </li>
  );
}

// ---- Suggestions for empty state ------------------------------------------

const EXAMPLES = [
  "authentication",
  "database",
  "session",
  "router",
  "validate",
];

// ---- Main component --------------------------------------------------------

export function SearchPage() {
  const { selected } = useRepository();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search: fire 350 ms after the user stops typing
  useEffect(() => {
    if (!selected || !query.trim()) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      api
        .search(selected.id, query.trim())
        .then((d) => setResults(d))
        .catch((e) => setError(e instanceof Error ? e.message : "Search failed"))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(t);
  }, [selected, query]);

  if (!selected) {
    return <div className="card text-sm text-content-muted">Select a repository to search.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Search</h1>
        <p className="mt-1 text-sm text-content-muted">
          Find files, functions, classes, and imports across the knowledge graph.
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-faint">
          ⌕
        </span>
        <input
          ref={inputRef}
          className="input w-full pl-9 py-3 text-base"
          placeholder="Search functions, files, classes, imports…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-content-faint text-sm">
            ⟳
          </span>
        )}
      </div>

      {error && (
        <div className="card border-risk-high/30 bg-risk-high/10 text-sm text-risk-high">{error}</div>
      )}

      {/* Results */}
      {results && (
        <div>
          <p className="mb-3 text-xs text-content-faint">
            {results.total === 0
              ? `No results for "${results.query}"`
              : `${results.total} result${results.total !== 1 ? "s" : ""} for "${results.query}"`}
          </p>
          {results.results.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-border">
              <ul>
                {results.results.map((r, i) => (
                  <ResultCard key={`${r.file_id}-${r.kind}-${r.symbol}-${i}`} result={r} query={results.query} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Empty state / suggestions */}
      {!query && !results && (
        <div className="card border-dashed py-10 text-center space-y-4">
          <p className="text-sm text-content-muted">
            Type to search across the repository knowledge graph.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                className="rounded-full border border-border px-3 py-1 text-xs text-content-faint hover:border-accent/40 hover:text-accent transition-colors"
                onClick={() => { setQuery(ex); inputRef.current?.focus(); }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No-results tip */}
      {results && results.total === 0 && (
        <div className="rounded-lg border border-border bg-bg-soft px-4 py-3 text-xs text-content-faint">
          <strong className="text-content-muted">Tips:</strong> Search matches file paths,
          function and class names, and import modules. Searches are case-insensitive substring matches.
          If the repository hasn&apos;t been analysed yet the knowledge graph will be empty.
        </div>
      )}
    </div>
  );
}
