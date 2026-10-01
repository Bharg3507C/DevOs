import { Link, Navigate } from "react-router-dom";
import { DependencyGraph3D } from "../components/marketing/DependencyGraph3D";
import { SignInButtons } from "../components/SignInButtons";
import { useAuth } from "../state/AuthContext";

export function Login() {
  const { authenticated, providers, devLogin } = useAuth();

  if (authenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-bg px-6 py-12">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <DependencyGraph3D className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/50" />
      </div>
      {/* Soft glow behind the card */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-[100px]" />

      {/* Card */}
      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-border-strong bg-bg-card/90 p-8 shadow-2xl backdrop-blur-lg">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-sm font-bold text-white shadow-lg">
              D
            </div>
            <span className="font-semibold tracking-tight">DevOS</span>
          </div>

          <h1 className="mt-7 text-2xl font-semibold tracking-tight">
            Sign in to continue
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-content-muted">
            Connect the account that hosts the repository you want to analyse.
          </p>

          <div className="mt-7">
            <SignInButtons />
          </div>

          {providers?.dev_mode ? (
            <div className="mt-5 border-t border-border pt-5">
              <button
                className="btn-ghost w-full justify-center text-xs"
                onClick={() => void devLogin()}
              >
                Continue in local dev mode
              </button>
              <p className="mt-2 text-center text-[11px] text-content-faint">
                No OAuth configured — uses a local test user
              </p>
            </div>
          ) : null}

          <Link
            to="/"
            className="mt-6 block text-center text-xs text-content-faint transition-colors hover:text-content-muted"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
