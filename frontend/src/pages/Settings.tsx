import { useEffect, useState } from "react";
import { api, BASE_URL } from "../api/client";
import { useTheme } from "../hooks/useTheme";
import type { CurrentUser } from "../types";

export function Settings() {
  const { theme, toggle } = useTheme();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold">Settings</h1>

      <div className="card">
        <h2 className="mb-2 text-sm font-medium">Account</h2>
        {user?.dev_mode ? (
          <p className="text-sm text-slate-400">
            Running in local development mode. GitHub OAuth is not configured, so
            a local user is used. Configure{" "}
            <code className="text-slate-200">GITHUB_CLIENT_ID</code> and{" "}
            <code className="text-slate-200">GITHUB_CLIENT_SECRET</code> to enable
            sign-in.
          </p>
        ) : user?.authenticated ? (
          <div className="flex items-center gap-3 text-sm">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full"
              />
            ) : null}
            <span>Signed in as {user.login}</span>
          </div>
        ) : (
          <a className="btn-primary" href={`${BASE_URL}/api/auth/github/login`}>
            Sign in with GitHub
          </a>
        )}
      </div>

      <div className="card">
        <h2 className="mb-2 text-sm font-medium">Appearance</h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            Theme (dark by default)
          </span>
          <button className="btn-ghost" onClick={toggle}>
            Switch to {theme === "dark" ? "light" : "dark"}
          </button>
        </div>
      </div>
    </div>
  );
}
