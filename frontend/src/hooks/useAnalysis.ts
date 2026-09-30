import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { AnalysisJob } from "../types";

// Triggers analysis for a repository and polls the job until it terminates.
export function useAnalysis(repositoryId: number | null) {
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const poll = useCallback(
    (jobId: number) => {
      stopPolling();
      pollRef.current = window.setInterval(async () => {
        try {
          const latest = await api.getJob(jobId);
          setJob(latest);
          if (latest.status === "completed" || latest.status === "failed") {
            stopPolling();
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to poll job");
          stopPolling();
        }
      }, 1200);
    },
    [stopPolling],
  );

  const start = useCallback(async () => {
    if (repositoryId == null) return;
    setStarting(true);
    setError(null);
    try {
      const { job: created } = await api.analyseRepository(repositoryId);
      setJob(created);
      poll(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start analysis");
    } finally {
      setStarting(false);
    }
  }, [repositoryId, poll]);

  useEffect(() => stopPolling, [stopPolling]);

  const isRunning =
    job != null && (job.status === "queued" || job.status === "running");

  return { job, error, starting, isRunning, start };
}
