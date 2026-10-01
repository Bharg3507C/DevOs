import type { AnalysisJob } from "../types";

const STEP_ORDER = [
  "Reading files",
  "Building syntax tree",
  "Detecting dependencies",
  "Analysing Git history",
  "Building knowledge graph",
  "Calculating code metrics",
];

function StepIcon({ status }: { status: string }) {
  if (status === "done")
    return (
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-risk-low/20 text-[10px] text-risk-low">
        ✓
      </span>
    );
  if (status === "running")
    return (
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/20 text-[10px] text-accent animate-spin">
        ⟳
      </span>
    );
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border text-[10px] text-content-faint">
      ·
    </span>
  );
}

export function AnalysisProgress({ job }: { job: AnalysisJob }) {
  const steps =
    job.steps ?? STEP_ORDER.map((name) => ({ name, status: "pending" as const }));

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium">
          {job.status === "completed"
            ? "Analysis complete"
            : job.status === "failed"
              ? "Analysis failed"
              : "Analysing repository…"}
        </p>
        {job.status === "completed" && (
          <span className="rounded-full bg-risk-low/15 px-2 py-0.5 text-xs text-risk-low">
            {job.files_processed} files
            {job.parsing_failures > 0 ? ` · ${job.parsing_failures} warnings` : ""}
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {steps.map((step) => (
          <li key={step.name} className="flex items-center gap-2.5">
            <StepIcon status={step.status} />
            <span
              className={`text-sm ${
                step.status === "done"
                  ? "text-content"
                  : step.status === "running"
                    ? "text-content"
                    : "text-content-faint"
              }`}
            >
              {step.name}
            </span>
          </li>
        ))}
      </ul>
      {job.status === "failed" && job.error ? (
        <div className="mt-4 rounded-lg border border-risk-high/30 bg-risk-high/10 p-3 text-xs text-risk-high">
          {job.error}
        </div>
      ) : null}
    </div>
  );
}
