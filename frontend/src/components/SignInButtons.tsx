import { BASE_URL } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { GitHubMark, GitLabMark } from "./ProviderIcons";

// Renders sign-in buttons for whichever providers the backend has configured.
// In dev mode (no OAuth configured) it explains the local-user fallback.
export function SignInButtons({ size = "md" }: { size?: "md" | "lg" }) {
  const { providers } = useAuth();
  const pad = size === "lg" ? "px-5 py-3 text-base" : "px-4 py-2 text-sm";

  const githubOn = providers?.github;
  const gitlabOn = providers?.gitlab;
  const devMode = providers?.dev_mode;

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <a
        href={githubOn ? `${BASE_URL}/api/auth/github/login` : undefined}
        aria-disabled={!githubOn}
        className={`inline-flex items-center justify-center gap-2 rounded-md bg-[#1f2328] font-medium text-white transition hover:bg-[#32383f] ${pad} ${
          githubOn ? "" : "pointer-events-none opacity-40"
        }`}
      >
        <GitHubMark className="h-5 w-5" />
        Continue with GitHub
      </a>
      <a
        href={gitlabOn ? `${BASE_URL}/api/auth/gitlab/login` : undefined}
        aria-disabled={!gitlabOn}
        className={`inline-flex items-center justify-center gap-2 rounded-md bg-[#fc6d26] font-medium text-white transition hover:bg-[#e24329] ${pad} ${
          gitlabOn ? "" : "pointer-events-none opacity-40"
        }`}
      >
        <GitLabMark className="h-5 w-5" />
        Continue with GitLab
      </a>
      {devMode ? (
        <p className="max-w-sm text-xs text-content-faint">
          OAuth isn&apos;t configured, so DevOS is running in local development
          mode with a local user. Set the provider client IDs/secrets to enable
          real sign-in.
        </p>
      ) : null}
    </div>
  );
}

export function ProviderBadge({ provider }: { provider: "github" | "gitlab" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-bg-soft px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-content-muted">
      {provider === "github" ? (
        <GitHubMark className="h-3 w-3" />
      ) : (
        <GitLabMark className="h-3 w-3" />
      )}
      {provider}
    </span>
  );
}
