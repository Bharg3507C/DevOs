import { Outlet } from "react-router-dom";
import { useRepository } from "../state/RepositoryContext";
import { useAnalysis } from "../hooks/useAnalysis";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AnalysisProgress } from "./AnalysisProgress";

// Analysis state lives at the layout level so progress persists while the user
// navigates between routes during a run. It is exposed to child routes via the
// Outlet context.
export interface OutletContext {
  refreshAfterAnalysis: () => void;
  lastCompletedJobId: number | null;
}

export function Layout() {
  const { selected } = useRepository();
  const { job, error, starting, isRunning, start } = useAnalysis(
    selected?.id ?? null,
  );

  const showProgress = job != null && (isRunning || job.status !== "queued");

  const outletContext: OutletContext = {
    refreshAfterAnalysis: () => {},
    lastCompletedJobId: job?.status === "completed" ? job.id : null,
  };

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onAnalyse={start} analysing={starting || isRunning} job={job} />
        <main className="min-h-0 flex-1 overflow-auto p-4">
          {error ? (
            <div className="mb-3 rounded border border-risk-high/40 bg-risk-high/10 p-2 text-sm text-risk-high">
              {error}
            </div>
          ) : null}
          {showProgress && job ? (
            <div className="mb-4">
              <AnalysisProgress job={job} />
            </div>
          ) : null}
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  );
}
