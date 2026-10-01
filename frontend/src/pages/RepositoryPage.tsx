import { useEffect, useState } from "react";
import { ApiError, api } from "../api/client";
import { ProviderBadge } from "../components/SignInButtons";
import { useAuth } from "../state/AuthContext";
import { useRepository } from "../state/RepositoryContext";
import type { BrowseRepoItem, Provider } from "../types";

// ---- Provider repo browser -------------------------------------------------

function ProviderRepoBrowser({
  onSelect,
}: {
  onSelect: (item: BrowseRepoItem) => void;
}) {
  const [items, setItems] = useState<BrowseRepoItem[]>([]);
  const [filtered, setFiltered] = useState<BrowseRepoItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .browseProviderRepos()
      .then((r) => {
        if (!cancelled) {
          setItems(r.items);
          setFiltered(r.items);
        }
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof ApiError ? e.message : "Could not load repositories");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? items.filter((r) => r.full_name.toLowerCase().includes(q)) : items);
  }, [search, items]);

  return (
    <div className="space-y-3">
      <input
        className="input w-full"
        placeholder="Filter repositories…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading && (
        <p className="py-4 text-center text-sm text-content-faint">
          <span className="animate-spin inline-block mr-1">⟳</span> Loading your repositories…
        </p>
      )}
      {error && (
        <p className="text-xs text-risk-medium">{error}</p>
      )}

      {!loading && filtered.length === 0 && !error && (
        <p className="py-4 text-center text-sm text-content-faint">
          {search ? `No repositories matching "${search}"` : "No repositories found."}
        </p>
      )}

      {filtered.length > 0 && (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
          <ul className="divide-y divide-border/60">
            {filtered.map((r) => (
              <li key={r.full_name}>
                <button
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-bg-elevated"
                  onClick={() => onSelect(r)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-content">
                      {r.full_name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-content-faint">
                      {r.primary_language && <span>{r.primary_language}</span>}
                      <span>{r.default_branch}</span>
                      {r.size_kb > 0 && (
                        <span>
                          {r.size_kb > 1024
                            ? `${(r.size_kb / 1024).toFixed(1)} MB`
                            : `${r.size_kb} KB`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.is_private && (
                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-content-faint">
                        private
                      </span>
                    )}
                    <span className="text-xs text-accent">+ Connect</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---- Main page -------------------------------------------------------------

export function RepositoryPage() {
  const { repositories, selected, selectRepository, refresh } = useRepository();
  const { user, providers } = useAuth();

  // Manual connect form state
  const [owner, setOwner] = useState("");
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<Provider>(user?.provider ?? "github");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whether to show the provider browser or the manual form
  const [mode, setMode] = useState<"browse" | "manual">("browse");

  // In dev mode there's no access token so the browse endpoint returns nothing
  const showBrowse = user?.authenticated && !user?.dev_mode;

  const showProviderChoice =
    (providers?.github ? 1 : 0) + (providers?.gitlab ? 1 : 0) > 1;

  async function connectRepo(repoOwner: string, repoName: string, repoProvider: string) {
    setBusy(true);
    setError(null);
    try {
      const { repository } = await api.connectRepository(repoOwner, repoName, repoProvider);
      await refresh();
      selectRepository(repository.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to connect repository");
    } finally {
      setBusy(false);
    }
  }

  async function handleBrowseSelect(item: BrowseRepoItem) {
    await connectRepo(item.owner, item.name, user?.provider ?? "github");
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    await connectRepo(owner.trim(), name.trim(), provider);
    setOwner("");
    setName("");
  }

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Repositories</h1>

      {/* Connect panel */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Connect a repository</p>
          {showBrowse && (
            <div className="flex gap-1 rounded-lg border border-border bg-bg-soft p-0.5">
              {(["browse", "manual"] as const).map((m) => (
                <button
                  key={m}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    mode === m
                      ? "bg-bg-card text-content shadow-sm"
                      : "text-content-faint hover:text-content"
                  }`}
                  onClick={() => setMode(m)}
                >
                  {m === "browse" ? "Browse" : "Manual"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Browse mode — provider repo list */}
        {(mode === "browse" && showBrowse) ? (
          <>
            <ProviderRepoBrowser onSelect={handleBrowseSelect} />
            {busy && (
              <p className="text-sm text-content-faint">
                <span className="animate-spin inline-block mr-1">⟳</span> Connecting…
              </p>
            )}
          </>
        ) : (
          /* Manual mode */
          <form onSubmit={handleManualSubmit} className="flex flex-wrap items-end gap-3">
            {showProviderChoice && (
              <div className="flex flex-col gap-1.5">
                <label className="eyebrow">Provider</label>
                <select
                  className="input"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as Provider)}
                >
                  {providers?.github && <option value="github">GitHub</option>}
                  {providers?.gitlab && <option value="gitlab">GitLab</option>}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="eyebrow">
                {provider === "gitlab" ? "Namespace" : "Owner"}
              </label>
              <input
                className="input"
                placeholder="octocat"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="eyebrow">Repository</label>
              <input
                className="input"
                placeholder="hello-world"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <button className="btn-primary" disabled={busy}>
              {busy ? "Connecting…" : "Connect"}
            </button>
          </form>
        )}

        {error && (
          <div className="rounded-lg border border-risk-high/30 bg-risk-high/10 p-3 text-sm text-risk-high">
            {error}
          </div>
        )}
      </div>

      {/* Connected repos list */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border bg-bg-soft px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-content-faint">
            Connected{" "}
            <span className="ml-1 text-content-muted">{repositories.length}</span>
          </p>
        </div>
        {repositories.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-content-faint">
            No repositories connected yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {repositories.map((r) => (
              <li
                key={r.id}
                className={`flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-bg-elevated ${
                  selected?.id === r.id ? "bg-accent/[0.05]" : ""
                }`}
              >
                <div className="min-w-0">
                  <button
                    className={`block truncate text-sm font-medium transition-colors ${
                      selected?.id === r.id
                        ? "text-accent"
                        : "text-content hover:text-accent"
                    }`}
                    onClick={() => selectRepository(r.id)}
                  >
                    {r.full_name}
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <ProviderBadge provider={r.provider} />
                    <span className="text-xs text-content-faint">
                      {r.primary_language ?? "unknown"}
                    </span>
                    <span className="text-xs text-content-faint">{r.default_branch}</span>
                    {r.is_private && (
                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-content-faint">
                        private
                      </span>
                    )}
                    {r.size_kb != null && r.size_kb > 0 && (
                      <span className="text-xs text-content-faint">
                        {r.size_kb > 1024
                          ? `${(r.size_kb / 1024).toFixed(1)} MB`
                          : `${r.size_kb} KB`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {selected?.id === r.id && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                      active
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
