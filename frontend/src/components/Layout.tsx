import { Outlet } from "react-router-dom";
import { useRepository } from "../state/RepositoryContext";
import { useAnalysis } from "../hooks/useAnalysis";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AnalysisProgress } from "./AnalysisProgress";

export interface OutletContext {
  lastCompletedJobId: number | null;
}

export function Layout() {
  const { selected, refresh } = useRepository();
  const { job, error, starting, isRunning, start } = useAnalysis(
    selected?.id ?? null,
  );

  // Refresh the repository list once analysis completes so overviews update.
  const handleStart = async () => {
    await start();
    if (job?.status === "completed") void refresh();
  };

  const showProgress = job != null && job.status !== "queued";

  const outletContext: OutletContext = {
    lastCompletedJobId: job?.status === "completed" ? job.id : null,
  };

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          onAnalyse={() => void handleStart()}
          analysing={starting || isRunning}
          job={job}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-5 py-5">
            {error && (
              <div className="mb-4 rounded-lg border border-risk-high/30 bg-risk-high/10 p-3 text-sm text-risk-high">
                {error}
              </div>
            )}
            {showProgress && job && (
              <div className="mb-5">
                <AnalysisProgress job={job} />
              </div>
            )}
            <Outlet context={outletContext} />
          </div>
        </main>
      </div>
    </div>
  );
}
