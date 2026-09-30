import type { AnalysisJob } from "../types";

const STEP_ORDER = [
  "Reading files",
  "Building syntax tree",
  "Detecting dependencies",
  "Analysing Git history",
  "Building knowledge graph",
  "Calculating code metrics",
];

function statusIcon(status: string): string {
  if (status === "done") return "\u2713"; // ✓
  if (status === "running") return "\u2026"; // …
  return "\u00b7"; // ·
}

export function AnalysisProgress({ job }: { job: AnalysisJob }) {
  const steps =
    job.steps ??
    STEP_ORDER.map((name) => ({ name, status: "pending" as const }));

  return (
    <div className="card">
      <div className="mb-2 text-sm font-medium">
        {job.status === "completed"
          ? "Repository analysis complete."
          : job.status === "failed"
            ? "Analysis failed."
            : "Parsing repository\u2026"}
      </div>
      <ul className="space-y-1 font-mono text-sm">
        {steps.map((step) => (
          <li
            key={step.name}
            className={
              step.status === "done"
                ? "text-risk-low"
                : step.status === "running"
                  ? "text-accent"
                  : "text-slate-500"
            }
          >
            <span className="inline-block w-4">{statusIcon(step.status)}</span>
            {step.name}
          </li>
        ))}
      </ul>
      {job.status === "failed" && job.error ? (
        <div className="mt-2 rounded border border-risk-high/40 bg-risk-high/10 p-2 text-xs text-risk-high">
          {job.error}
        </div>
      ) : null}
      {job.status === "completed" ? (
        <div className="mt-2 text-xs text-slate-500">
          {job.files_processed} files processed
          {job.parsing_failures > 0
            ? ` · ${job.parsing_failures} parse warnings`
            : ""}
        </div>
      ) : null}
    </div>
  );
}
