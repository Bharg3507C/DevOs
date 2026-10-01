import { useTheme } from "../hooks/useTheme";
import { useRepository } from "../state/RepositoryContext";
import type { AnalysisJob } from "../types";

interface TopBarProps {
  onAnalyse: () => void;
  analysing: boolean;
  job: AnalysisJob | null;
}

export function TopBar({ onAnalyse, analysing, job }: TopBarProps) {
  const { repositories, selected, selectRepository } = useRepository();
  const { theme, toggle } = useTheme();

  return (
    <header className="flex items-center gap-3 border-b border-border bg-bg-soft/80 px-4 py-2.5 backdrop-blur">
      <label className="text-xs text-content-faint">Repo</label>
      <select
        className="input min-w-[200px] cursor-pointer py-1.5"
        value={selected?.id ?? ""}
        onChange={(e) => selectRepository(Number(e.target.value))}
        disabled={repositories.length === 0}
      >
        {repositories.length === 0 ? (
          <option value="">No repositories connected</option>
        ) : (
          repositories.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))
        )}
      </select>

      <button
        className="btn-primary"
        onClick={onAnalyse}
        disabled={!selected || analysing}
      >
        {analysing ? (
          <>
            <span className="animate-spin">⟳</span>
            Analysing…
          </>
        ) : (
          "Analyse Repository"
        )}
      </button>

      {job && (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            job.status === "completed"
              ? "bg-risk-low/15 text-risk-low"
              : job.status === "failed"
                ? "bg-risk-high/15 text-risk-high"
                : "bg-accent/15 text-accent"
          }`}
        >
          {job.status}
        </span>
      )}

      <div className="ml-auto">
        <button
          className="btn-ghost px-2 py-1.5 text-xs"
          onClick={toggle}
          title="Toggle theme"
        >
          {theme === "dark" ? "☀ Light" : "☾ Dark"}
        </button>
      </div>
    </header>
  );
}
