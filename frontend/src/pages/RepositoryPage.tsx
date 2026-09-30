import { useState } from "react";
import { ApiError, api } from "../api/client";
import { useRepository } from "../state/RepositoryContext";

export function RepositoryPage() {
  const { repositories, selected, selectRepository, refresh } = useRepository();
  const [owner, setOwner] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { repository } = await api.connectRepository(owner.trim(), name.trim());
      await refresh();
      selectRepository(repository.id);
      setOwner("");
      setName("");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to connect repository");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Connect a repository</h1>

      <form onSubmit={connect} className="card flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Owner</label>
          <input
            className="input"
            placeholder="octocat"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Repository</label>
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

      {error ? (
        <div className="rounded border border-risk-high/40 bg-risk-high/10 p-2 text-sm text-risk-high">
          {error}
        </div>
      ) : null}

      <div className="card">
        <h2 className="mb-3 text-sm font-medium">Connected repositories</h2>
        {repositories.length === 0 ? (
          <p className="text-sm text-slate-500">None yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {repositories.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <div>
                  <button
                    className={`font-medium ${
                      selected?.id === r.id ? "text-accent" : "text-slate-200"
                    }`}
                    onClick={() => selectRepository(r.id)}
                  >
                    {r.full_name}
                  </button>
                  <div className="text-xs text-slate-500">
                    {r.primary_language ?? "unknown"} · {r.default_branch}
                    {r.is_private ? " · private" : ""}
                  </div>
                </div>
                {selected?.id === r.id ? (
                  <span className="text-xs text-accent">selected</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
