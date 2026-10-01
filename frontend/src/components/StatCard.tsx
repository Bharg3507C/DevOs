interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}

export function StatCard({ label, value, hint, accent }: StatCardProps) {
  return (
    <div
      className={`card flex flex-col gap-1 transition-shadow hover:shadow-md ${
        accent ? "border-accent/40 bg-accent/[0.06]" : ""
      }`}
    >
      <div className="eyebrow">{label}</div>
      <div
        className={`text-2xl font-semibold tabular-nums tracking-tight ${
          accent ? "text-accent" : "text-content"
        }`}
      >
        {value}
      </div>
      {hint ? <div className="text-xs text-content-faint">{hint}</div> : null}
    </div>
  );
}
