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

function Cell({ value }: { value: boolean | string }) {
  if (value === true)
    return <span className="text-risk-low">Yes</span>;
  if (value === false)
    return <span className="text-slate-600">No</span>;
  return <span className="text-slate-400">{value}</span>;
}

export function Home() {
  const { authenticated } = useAuth();

  return (
    <div className="min-h-full bg-bg text-slate-200">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-accent" />
            <span className="font-semibold tracking-tight">DevOS</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
            <a href="#features" className="hover:text-slate-200">Features</a>
            <a href="#how" className="hover:text-slate-200">How it works</a>
            <a href="#compare" className="hover:text-slate-200">Compare</a>
          </nav>
          <Link to="/dashboard" className="btn-primary">
            {authenticated ? "Open app" : "Launch DevOS"}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <DependencyGraph3D className="absolute right-[-10%] top-[-10%] h-[130%] w-[70%] opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full border border-border bg-bg-soft px-3 py-1 text-xs text-slate-400">
              Developer intelligence, not another dashboard
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              Understand your codebase
              <span className="block text-accent">before you change it.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-400">
              DevOS connects to a real GitHub or GitLab repository, statically
              analyses the code, and builds a traceable knowledge graph of your
              architecture, dependencies, technical debt, and change impact.
            </p>
            <div className="mt-8">
              <SignInButtons size="lg" />
            </div>
            <p className="mt-4 text-xs text-slate-600">
              Every insight is traceable to a file, a line, or a metric. No
              fabricated statistics.
            </p>
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
            <p className="mt-4 max-w-3xl text-slate-400">
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
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            What DevOS does
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <div className="card h-full">
                <h3 className="text-sm font-semibold text-slate-200">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm text-slate-400">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border/60 bg-bg-soft/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              How repository analysis works
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ["Connect", "Sign in with GitHub or GitLab. DevOS verifies access and reads metadata."],
              ["Ingest safely", "The repo is cloned into a sandbox. Code is parsed statically and never executed."],
              ["Build the graph", "Files, symbols, imports, and dependencies are stored as a queryable knowledge graph."],
              ["Analyse", "Deterministic engines compute impact, debt, cycles, and Git hotspots."],
              ["Explore", "Navigate architecture, files, and change impact in the app."],
              ["Ask", "The grounded AI layer answers with cited evidence from your repo."],
            ].map(([title, body], i) => (
              <Reveal key={title} delay={i * 60}>
                <div className="card h-full">
                  <div className="text-xs text-accent">Step {i + 1}</div>
                  <h3 className="mt-1 text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-slate-400">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="compare" className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            DevOS vs GitHub vs GitLab
          </h2>
          <p className="mt-3 max-w-3xl text-slate-400">
            GitHub and GitLab are excellent places to host and ship code. DevOS
            is a different layer: it works <em>on top of</em> the repositories
            you already keep there, answering questions about structure and risk
            that a hosting platform isn&apos;t built to answer.
          </p>
        </Reveal>
        <Reveal>
          <div className="mt-8 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-soft text-left">
                  <th className="px-4 py-3 font-medium">Capability</th>
                  <th className="px-4 py-3 font-medium text-accent">DevOS</th>
                  <th className="px-4 py-3 font-medium">GitHub</th>
                  <th className="px-4 py-3 font-medium">GitLab</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.capability} className="border-b border-border/60">
                    <td className="px-4 py-3 text-slate-300">{row.capability}</td>
                    <td className="px-4 py-3"><Cell value={row.devos} /></td>
                    <td className="px-4 py-3"><Cell value={row.github} /></td>
                    <td className="px-4 py-3"><Cell value={row.gitlab} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Comparison reflects DevOS&apos;s focus on static code intelligence.
            GitHub and GitLab offer broad DevOps platforms; the rows above only
            cover code-understanding capabilities.
          </p>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 bg-bg-soft/40">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Point DevOS at a repository.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-400">
              Connect GitHub or GitLab and get a traceable map of your codebase
              in minutes.
            </p>
            <div className="mt-8 flex justify-center">
              <SignInButtons size="lg" />
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-xs text-slate-600 sm:flex-row">
          <span>DevOS · Understand your codebase before you change it.</span>
          <Link to="/dashboard" className="hover:text-slate-400">
            Open the app →
          </Link>
        </div>
      </footer>
    </div>
  );
}
