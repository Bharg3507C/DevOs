import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../state/AuthContext";
import { SignInButtons } from "../components/SignInButtons";
import { GitHubMark, GitLabMark } from "../components/ProviderIcons";

export function Settings() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      {/* Account */}
      <div className="card">
        <p className="eyebrow mb-4">Account</p>
        {user?.dev_mode ? (
          <div className="rounded-lg border border-border-strong bg-bg-soft p-4">
            <p className="text-sm font-medium">Local development mode</p>
            <p className="mt-1 text-sm text-content-muted">
              OAuth is not configured. Set{" "}
              <code className="rounded bg-bg-elevated px-1 py-0.5 font-mono text-xs text-accent">
                GITHUB_CLIENT_ID
              </code>{" "}
              /{" "}
              <code className="rounded bg-bg-elevated px-1 py-0.5 font-mono text-xs text-accent">
                GITLAB_CLIENT_ID
              </code>{" "}
              and their secrets on the server to enable real sign-in and
              private-repo access.
            </p>
          </div>
        ) : user?.authenticated ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full ring-2 ring-border-strong"
                />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-full bg-bg-elevated text-content-faint">
                  {user.provider === "gitlab" ? (
                    <GitLabMark className="h-5 w-5" />
                  ) : (
                    <GitHubMark className="h-5 w-5" />
                  )}
                </div>
              )}
              <div>
                <p className="text-sm font-medium">{user.login}</p>
                <p className="text-xs text-content-faint">
                  via {user.provider}
                </p>
              </div>
            </div>
            <button
              className="btn-ghost text-sm"
              onClick={() => void logout()}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-content-muted">Not signed in.</p>
            <SignInButtons />
          </div>
        )}
      </div>

      {/* Appearance */}
      <div className="card">
        <p className="eyebrow mb-4">Appearance</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="mt-0.5 text-xs text-content-muted">
              Currently {theme === "dark" ? "dark" : "light"} mode
            </p>
          </div>
          <button className="btn-ghost" onClick={toggle}>
            Switch to {theme === "dark" ? "☀ light" : "☾ dark"}
          </button>
        </div>
      </div>

      {/* Backend info */}
      <div className="card">
        <p className="eyebrow mb-4">About</p>
        <dl className="space-y-2 text-sm">
          {[
            ["Version", "0.1.0 · Phase 1"],
            ["Analysis", "Static · no code execution"],
            ["Providers", "GitHub · GitLab"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-content-faint">{k}</dt>
              <dd className="text-content">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
