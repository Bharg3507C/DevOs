export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-border-strong bg-bg-card text-2xl text-content-faint">
        ◈
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 max-w-sm text-sm text-content-muted">
          This view is planned for{" "}
          <span className="font-medium text-content">{phase}</span>. DevOS only
          shows insights derived from real repository analysis — this page will
          light up once the underlying analysis is implemented.
        </p>
      </div>
      <div className="rounded-full border border-border px-3 py-1 text-xs text-content-faint">
        {phase}
      </div>
    </div>
  );
}
