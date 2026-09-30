import { NavLink } from "react-router-dom";

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
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-bg-soft">
      <div className="px-4 py-4">
        <div className="text-lg font-semibold tracking-tight">DevOS</div>
        <div className="text-xs text-slate-500">
          Understand your codebase before you change it.
        </div>
      </div>
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
      <div className="px-4 py-3 text-[11px] text-slate-600">Phase 1 · v0.1.0</div>
    </aside>
  );
}
