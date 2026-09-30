import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { GitHubMark, GitLabMark } from "./ProviderIcons";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/repository", label: "Repository" },
  { to: "/architecture", label: "Architecture" },
  { to: "/files", label: "Files" },
  { to: "/impact", label: "Change Impact" },
  { to: "/technical-debt", label: "Technical Debt" },
  { to: "/git-history", label: "Git History" },
  { to: "/search", label: "Search" },
  { to: "/settings", label: "Settings" },
];

// Routes not yet backed by Phase 1 endpoints are marked so the UI is honest
// about what is implemented.
const PHASE1_READY = new Set(["/dashboard", "/repository", "/files", "/settings"]);

export function Sidebar() {
  const { user, logout } = useAuth();
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-bg-soft">
      <Link to="/" className="block px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-accent" />
          <span className="text-lg font-semibold tracking-tight">DevOS</span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Understand your codebase before you change it.
        </div>
      </Link>
      <nav className="flex-1 space-y-0.5 px-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                isActive
                  ? "bg-accent-soft text-white"
                  : "text-slate-400 hover:bg-bg-card hover:text-slate-200"
              }`
            }
          >
            <span>{item.label}</span>
            {!PHASE1_READY.has(item.to) ? (
              <span className="rounded bg-bg-card px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                soon
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border px-4 py-3">
        {user?.authenticated ? (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              {user.provider === "gitlab" ? (
                <GitLabMark className="h-3.5 w-3.5" />
              ) : (
                <GitHubMark className="h-3.5 w-3.5" />
              )}
              {user.login}
            </span>
            <button
              onClick={() => void logout()}
              className="text-[11px] text-slate-500 hover:text-slate-300"
            >
              Sign out
            </button>
          </div>
        ) : null}
        <div className="mt-2 text-[11px] text-slate-600">v0.1.0</div>
      </div>
    </aside>
  );
}
