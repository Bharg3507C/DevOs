import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../state/AuthContext";
import { SignInButtons } from "../components/SignInButtons";
import { GitHubMark, GitLabMark } from "../components/ProviderIcons";

export function Settings() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold">Settings</h1>

      <div className="card">
        <h2 className="mb-2 text-sm font-medium">Account</h2>
        {user?.dev_mode ? (
          <p className="text-sm text-slate-400">
            Running in local development mode. OAuth is not configured, so a
            local user is used. Set the GitHub and/or GitLab client IDs and
            secrets on the server to enable real sign-in and private-repo access.
          </p>
        ) : user?.authenticated ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full" />
              ) : user.provider === "gitlab" ? (
                <GitLabMark className="h-6 w-6" />
              ) : (
                <GitHubMark className="h-6 w-6" />
              )}
              <span>
                Signed in as {user.login}
                <span className="ml-1 text-slate-500">via {user.provider}</span>
              </span>
            </div>
            <button className="btn-ghost" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        ) : (
          <SignInButtons />
        )}
      </div>

      <div className="card">
        <h2 className="mb-2 text-sm font-medium">Appearance</h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Theme (dark by default)</span>
          <button className="btn-ghost" onClick={toggle}>
            Switch to {theme === "dark" ? "light" : "dark"}
          </button>
        </div>
      </div>
    </div>
  );
}
