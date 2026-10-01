import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { GitHubMark, GitLabMark } from "./ProviderIcons";

const NAV = [
  { to: "/dashboard",      label: "Dashboard",      icon: "⬡" },
  { to: "/repository",     label: "Repository",     icon: "⊞" },
  { to: "/architecture",   label: "Architecture",   icon: "◈" },
  { to: "/files",          label: "Files",          icon: "≡" },
  { to: "/impact",         label: "Change Impact",  icon: "⟳" },
  { to: "/technical-debt", label: "Technical Debt", icon: "△" },
  { to: "/git-history",    label: "Git History",    icon: "⊚" },
  { to: "/search",         label: "Search",         icon: "⌕" },
  { to: "/settings",       label: "Settings",       icon: "⊗" },
];

// All routes now have real implementations.
const PHASE_LABEL: Record<string, string> = {};

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-bg-soft">
      {/* Logo */}
      <Link
        to="/"
        className="flex items-center gap-2.5 border-b border-border px-4 py-4 transition-opacity hover:opacity-80"
      >
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-sm font-bold text-white shadow">
          D
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight tracking-tight">DevOS</div>
          <div className="text-[10px] leading-tight text-content-faint">Intelligence</div>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all ${
                isActive
                  ? "bg-accent/15 font-medium text-accent"
                  : "text-content-muted hover:bg-bg-card hover:text-content"
              }`
            }
          >
            <span className="flex items-center gap-2.5">
              <span className="font-mono text-base leading-none opacity-60">
                {item.icon}
              </span>
              {item.label}
            </span>
            {PHASE_LABEL[item.to] ? (
              <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-content-faint">
                {PHASE_LABEL[item.to]}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      {/* Account footer */}
      <div className="border-t border-border px-3 py-3">
        {user?.authenticated ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="h-6 w-6 shrink-0 rounded-full ring-1 ring-border-strong"
                />
              ) : user.provider === "gitlab" ? (
                <GitLabMark className="h-4 w-4 shrink-0 text-content-faint" />
              ) : (
                <GitHubMark className="h-4 w-4 shrink-0 text-content-faint" />
              )}
              <span className="truncate text-xs text-content-muted">{user.login}</span>
            </div>
            <button
              onClick={() => void logout()}
              className="shrink-0 rounded px-1.5 py-1 text-[11px] text-content-faint transition-colors hover:bg-bg-card hover:text-risk-high"
              title="Sign out"
            >
              ↩
            </button>
          </div>
        ) : null}
        <div className="mt-2 text-[10px] text-content-faint">v0.1.0 · Phase 1–2</div>
      </div>
    </aside>
  );
}
