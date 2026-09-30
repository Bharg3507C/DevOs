// Minimal brand glyphs for provider buttons/badges. Simple marks, not full
// logos, to keep things clean and license-safe.

export function GitHubMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function GitLabMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <path
        fill="#e24329"
        d="M8 15 5.05 5.93h5.9L8 15Z"
      />
      <path fill="#fc6d26" d="M8 15 5.05 5.93H1.13L8 15Z" />
      <path
        fill="#fca326"
        d="M1.13 5.93.24 8.67a.6.6 0 0 0 .22.67L8 15 1.13 5.93Z"
      />
      <path fill="#e24329" d="M1.13 5.93h3.92L3.36.74a.3.3 0 0 0-.57 0L1.13 5.93Z" />
      <path fill="#fc6d26" d="M8 15l2.95-9.07h3.92L8 15Z" />
      <path
        fill="#fca326"
        d="M14.87 5.93l.89 2.74a.6.6 0 0 1-.22.67L8 15l6.87-9.07Z"
      />
      <path
        fill="#e24329"
        d="M14.87 5.93h-3.92L12.64.74a.3.3 0 0 1 .57 0l1.66 5.19Z"
      />
    </svg>
  );
}
