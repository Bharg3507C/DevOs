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
    <header className="flex items-center gap-3 border-b border-border bg-bg-soft px-4 py-2.5">
      <label className="text-xs text-slate-500">Repository</label>
      <select
        className="input min-w-[220px]"
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
        {analysing ? "Analysing\u2026" : "Analyse Repository"}
      </button>

      {job ? (
        <span className="text-xs text-slate-500">
          job #{job.id} · {job.status}
        </span>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <button className="btn-ghost" onClick={toggle} title="Toggle theme">
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>
    </header>
  );
}
