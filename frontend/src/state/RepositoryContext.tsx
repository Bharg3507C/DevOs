import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import type { Repository } from "../types";

interface RepositoryContextValue {
  repositories: Repository[];
  selected: Repository | null;
  loading: boolean;
  error: string | null;
  selectRepository: (id: number) => void;
  refresh: () => Promise<void>;
}

const RepositoryContext = createContext<RepositoryContextValue | undefined>(
  undefined,
);

const STORAGE_KEY = "devos.selectedRepositoryId";

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Number(stored) : null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const repos = await api.listRepositories();
      setRepositories(repos);
      setSelectedId((current) => {
        if (current && repos.some((r) => r.id === current)) return current;
        return repos.length > 0 ? repos[0].id : null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load repositories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (selectedId != null) localStorage.setItem(STORAGE_KEY, String(selectedId));
  }, [selectedId]);

  const selectRepository = useCallback((id: number) => setSelectedId(id), []);

  const selected = useMemo(
    () => repositories.find((r) => r.id === selectedId) ?? null,
    [repositories, selectedId],
  );

  const value = useMemo(
    () => ({ repositories, selected, loading, error, selectRepository, refresh }),
    [repositories, selected, loading, error, selectRepository, refresh],
  );

  return (
    <RepositoryContext.Provider value={value}>
      {children}
    </RepositoryContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRepository(): RepositoryContextValue {
  const ctx = useContext(RepositoryContext);
  if (!ctx)
    throw new Error("useRepository must be used within a RepositoryProvider");
  return ctx;
}
