import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisProgress } from "../components/AnalysisProgress";
import type { AnalysisJob } from "../types";

function makeJob(overrides: Partial<AnalysisJob>): AnalysisJob {
  return {
    id: 1,
    repository_id: 1,
    status: "running",
    steps: [
      { name: "Reading files", status: "done" },
      { name: "Building syntax tree", status: "running" },
      { name: "Detecting dependencies", status: "pending" },
    ],
    error: null,
    files_processed: 0,
    parsing_failures: 0,
    started_at: null,
    finished_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("AnalysisProgress", () => {
  it("renders the running state with step labels", () => {
    render(<AnalysisProgress job={makeJob({ status: "running" })} />);
    expect(screen.getByText(/Parsing repository/i)).toBeInTheDocument();
    expect(screen.getByText("Reading files")).toBeInTheDocument();
    expect(screen.getByText("Detecting dependencies")).toBeInTheDocument();
  });

  it("shows completion summary", () => {
    render(
      <AnalysisProgress
        job={makeJob({
          status: "completed",
          files_processed: 12,
          parsing_failures: 1,
        })}
      />,
    );
    expect(screen.getByText(/Repository analysis complete/i)).toBeInTheDocument();
    expect(screen.getByText(/12 files processed/i)).toBeInTheDocument();
    expect(screen.getByText(/1 parse warnings/i)).toBeInTheDocument();
  });

  it("shows an error when the job failed", () => {
    render(
      <AnalysisProgress
        job={makeJob({ status: "failed", error: "git clone failed" })}
      />,
    );
    expect(screen.getByText(/Analysis failed/i)).toBeInTheDocument();
    expect(screen.getByText(/git clone failed/i)).toBeInTheDocument();
  });
});
