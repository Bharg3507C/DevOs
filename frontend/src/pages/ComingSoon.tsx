// Honest placeholder for routes whose backend analysis lands in a later phase.
// It never displays fabricated data.
export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="card max-w-2xl">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-slate-400">
        This view is planned for <span className="text-slate-200">{phase}</span>.
        DevOS only shows insights that are derived from real repository analysis,
        so this page will light up once the underlying analysis is implemented.
      </p>
    </div>
  );
}
