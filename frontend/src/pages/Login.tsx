import { Link } from "react-router-dom";
import { DependencyGraph3D } from "../components/marketing/DependencyGraph3D";
import { SignInButtons } from "../components/SignInButtons";

// Sign-in screen shown when an unauthenticated user tries to open the app.
export function Login() {
  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-bg px-6">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <DependencyGraph3D className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-bg/30" />
      </div>
      <div className="relative w-full max-w-md rounded-xl border border-border bg-bg-card/90 p-8 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-accent" />
          <span className="font-semibold tracking-tight">DevOS</span>
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          Sign in to continue
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Connect the account that hosts the repository you want to analyse.
        </p>
        <div className="mt-6">
          <SignInButtons />
        </div>
        <Link
          to="/"
          className="mt-6 inline-block text-xs text-slate-500 hover:text-slate-300"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
