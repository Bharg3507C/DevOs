import { Link } from "react-router-dom";
import { DependencyGraph3D } from "../components/marketing/DependencyGraph3D";
import { Reveal } from "../components/marketing/Reveal";
import { SignInButtons } from "../components/SignInButtons";
import { useAuth } from "../state/AuthContext";

const FEATURES = [
  {
    title: "Repository knowledge graph",
    body: "DevOS parses your source statically and builds a structured graph of files, functions, classes, imports, and dependencies you can query.",
  },
  {
    title: "Change impact analysis",
    body: "Select a file or function and DevOS traverses the dependency graph (BFS/DFS) to show direct and indirect dependents, related tests, and blast radius.",
  },
  {
    title: "Transparent technical debt",
    body: "No opaque AI score. Every finding lists the exact signals — complexity, coupling, churn, missing tests — that produced it.",
  },
  {
    title: "Git intelligence",
    body: "Change frequency, code churn, and hotspots computed from real history, so you can see which areas are becoming risky.",
  },
  {
    title: "Circular dependency detection",
    body: "DFS cycle detection surfaces structural loops clearly, reported as findings — not automatically labelled bugs.",
  },
  {
    title: "Grounded AI layer",
    body: "The AI answers only from repository-derived context and cites its evidence: file and line numbers. Never a generic chatbot.",
  },
];

const COMPARISON: {
  capability: string;
  devos: boolean | string;
  github: boolean | string;
  gitlab: boolean | string;
}[] = [
  {
    capability: "Host and version your code",
    devos: "Reads your repo",
    github: true,
    gitlab: true,
  },
  { capability: "Static code knowledge graph", devos: true, github: false, gitlab: false },
  { capability: "Change impact / blast radius", devos: true, github: false, gitlab: false },
  { capability: "Circular dependency detection", devos: true, github: false, gitlab: false },
  {
    capability: "Transparent technical-debt signals",
    devos: true,
    github: "Partial (Actions/3rd-party)",
    gitlab: "Partial (Code Quality)",
  },
  { capability: "Cross-file dependency traversal", devos: true, github: false, gitlab: false },
  {
    capability: "Evidence-cited answers about the codebase",
    devos: true,
    github: "Copilot (generative)",
    gitlab: "Duo (generative)",
  },
  { capability: "Works on GitHub repos", devos: true, github: true, gitlab: false },
  { capability: "Works on GitLab repos", devos: true, github: false, gitlab: true },
];

const STATS = [
  ["Static", "no code executed"],
  ["Traceable", "file · line · metric"],
  ["2 providers", "GitHub + GitLab"],
  ["Deterministic", "no fake AI scores"],
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true)
    return (
      <span className="inline-flex items-center gap-1 text-risk-low">
        <span className="text-base leading-none">✓</span> Yes
      </span>
    );
  if (value === false)
    return <span className="text-content-faint">—</span>;
  return <span className="text-content-muted">{value}</span>;
}

export function Home() {
  const { authenticated } = useAuth();

  return (
    <div className="min-h-full bg-bg text-content">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-border/60 glass">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-accent to-accent-strong text-[11px] font-bold text-white">
              D
            </div>
            <span className="font-semibold tracking-tight">DevOS</span>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-content-muted md:flex">
            <a href="#features" className="hover:text-content">Features</a>
            <a href="#how" className="hover:text-content">How it works</a>
            <a href="#compare" className="hover:text-content">Compare</a>
          </nav>
          <Link to="/dashboard" className="btn-primary">
            {authenticated ? "Open app" : "Launch DevOS"}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Layered backdrop: subtle grid, rose glow, and the 3D graph. */}
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.35]" />
        <div className="pointer-events-none absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-accent/20 blur-[120px]" />
        <div className="pointer-events-none absolute inset-0">
          <DependencyGraph3D className="absolute right-[-8%] top-[-6%] h-[120%] w-[62%] opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg to-transparent" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-28 md:py-36">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-bg-soft/80 px-3 py-1 text-xs text-content-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Developer intelligence, not another dashboard
            </span>
            <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
              Understand your
              <br />
              codebase{" "}
              <span className="text-gradient">before you change it.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-content-muted">
              DevOS connects to a real GitHub or GitLab repository, statically
              analyses the code, and builds a traceable knowledge graph of your
              architecture, dependencies, technical debt, and change impact.
            </p>
            <div className="mt-8">
              <SignInButtons size="lg" />
            </div>
            <p className="mt-4 text-xs text-content-faint">
              Every insight is traceable to a file, a line, or a metric. No
              fabricated statistics.
            </p>

            <div className="mt-12 grid max-w-lg grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
              {STATS.map(([big, small]) => (
                <div key={big}>
                  <div className="text-sm font-semibold text-content">{big}</div>
                  <div className="text-xs text-content-faint">{small}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-t border-border/60 bg-bg-soft/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              A repo tells you what the code is. It doesn&apos;t tell you what
              will break.
            </h2>
            <p className="mt-4 max-w-3xl text-content-muted">
              Before touching a function, engineers need to know what depends on
              it, where the risk is concentrated, and why a module exists. That
              knowledge is scattered across the code, the Git history, and
              people&apos;s heads. DevOS reconstructs it directly from the
              repository so it is explicit, queryable, and honest.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <p className="eyebrow">Capabilities</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            What DevOS does
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <div className="card card-hover group h-full">
                <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg border border-border-strong bg-bg-soft text-sm font-semibold text-accent transition-colors group-hover:border-accent/50">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="text-base font-semibold text-content">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-content-muted">
                  {f.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-border/60 bg-bg-soft/40">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="eyebrow">Pipeline</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              How repository analysis works
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              ["Connect", "Sign in with GitHub or GitLab. DevOS verifies access and reads metadata."],
              ["Ingest safely", "The repo is cloned into a sandbox. Code is parsed statically and never executed."],
              ["Build the graph", "Files, symbols, imports, and dependencies are stored as a queryable knowledge graph."],
              ["Analyse", "Deterministic engines compute impact, debt, cycles, and Git hotspots."],
              ["Explore", "Navigate architecture, files, and change impact in the app."],
              ["Ask", "The grounded AI layer answers with cited evidence from your repo."],
            ].map(([title, body], i) => (
              <Reveal key={title} delay={i * 60}>
                <div className="card card-hover h-full">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                      {i + 1}
                    </span>
                    <h3 className="text-sm font-semibold">{title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-content-muted">
                    {body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="compare" className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <p className="eyebrow">Where it fits</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            DevOS vs GitHub vs GitLab
          </h2>
          <p className="mt-3 max-w-3xl text-content-muted">
            GitHub and GitLab are excellent places to host and ship code. DevOS
            is a different layer: it works <em>on top of</em> the repositories
            you already keep there, answering questions about structure and risk
            that a hosting platform isn&apos;t built to answer.
          </p>
        </Reveal>
        <Reveal>
          <div className="mt-10 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-soft text-left">
                  <th className="px-5 py-4 font-medium text-content-muted">
                    Capability
                  </th>
                  <th className="px-5 py-4 font-semibold text-accent">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-accent" />
                      DevOS
                    </span>
                  </th>
                  <th className="px-5 py-4 font-medium text-content-muted">GitHub</th>
                  <th className="px-5 py-4 font-medium text-content-muted">GitLab</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr
                    key={row.capability}
                    className={`border-t border-border/60 ${
                      i % 2 ? "bg-bg-soft/30" : ""
                    }`}
                  >
                    <td className="px-5 py-3.5 text-content">{row.capability}</td>
                    <td className="bg-accent/[0.06] px-5 py-3.5 font-medium">
                      <Cell value={row.devos} />
                    </td>
                    <td className="px-5 py-3.5"><Cell value={row.github} /></td>
                    <td className="px-5 py-3.5"><Cell value={row.gitlab} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-content-faint">
            Comparison reflects DevOS&apos;s focus on static code intelligence.
            GitHub and GitLab offer broad DevOps platforms; the rows above only
            cover code-understanding capabilities.
          </p>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-border-strong bg-bg-card px-8 py-16 text-center">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full bg-accent/20 blur-[100px]" />
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Point DevOS at a repository.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-content-muted">
                Connect GitHub or GitLab and get a traceable map of your codebase
                in minutes.
              </p>
              <div className="mt-8 flex justify-center">
                <SignInButtons size="lg" />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-content-faint sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="grid h-5 w-5 place-items-center rounded bg-gradient-to-br from-accent to-accent-strong text-[9px] font-bold text-white">
              D
            </div>
            <span>DevOS · Understand your codebase before you change it.</span>
          </div>
          <Link to="/dashboard" className="hover:text-content-muted transition-colors">
            Open the app →
          </Link>
        </div>
      </footer>
    </div>
  );
}
