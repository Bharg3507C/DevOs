import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { api } from "../api/client";
import { useRepository } from "../state/RepositoryContext";
import type { ArchNode, Architecture } from "../types";

// ---- Colour helpers --------------------------------------------------------

const LANG_COLOR: Record<string, string> = {
  python:     "#3b7edd",
  typescript: "#38bdf8",
  javascript: "#facc15",
  go:         "#06b6d4",
  rust:       "#f97316",
  java:       "#f59e0b",
  ruby:       "#e11d48",
};

function nodeColor(lang: string | null, isTest: boolean): string {
  if (isTest) return "#8aa29e";
  return LANG_COLOR[lang ?? ""] ?? "#6b7280";
}

// ---- Layout (simple layered left→right based on dependency depth) ----------

function layoutNodes(
  nodes: ArchNode[],
  edges: { source: string; target: string }[],
): Record<string, { x: number; y: number }> {
  // BFS to assign depth (layer) to each node
  const adj: Record<string, string[]> = {};
  const inDeg: Record<string, number> = {};
  for (const n of nodes) { adj[n.id] = []; inDeg[n.id] = 0; }
  for (const e of edges) {
    adj[e.source]?.push(e.target);
    inDeg[e.target] = (inDeg[e.target] ?? 0) + 1;
  }
  const depth: Record<string, number> = {};
  const queue = nodes.filter((n) => (inDeg[n.id] ?? 0) === 0).map((n) => n.id);
  queue.forEach((id) => (depth[id] = 0));
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    for (const nbr of adj[cur] ?? []) {
      const d = (depth[cur] ?? 0) + 1;
      if (depth[nbr] === undefined || depth[nbr] < d) {
        depth[nbr] = d;
        queue.push(nbr);
      }
    }
  }
  nodes.forEach((n) => { if (depth[n.id] === undefined) depth[n.id] = 0; });

  // Group by depth layer, sort within each layer by path
  const layers: Record<number, string[]> = {};
  for (const n of nodes) {
    const d = depth[n.id];
    (layers[d] ??= []).push(n.id);
  }

  const pos: Record<string, { x: number; y: number }> = {};
  const H_GAP = 260;
  const V_GAP = 80;

  for (const [layerStr, ids] of Object.entries(layers)) {
    const layer = Number(layerStr);
    const x = layer * H_GAP + 40;
    ids.forEach((id, i) => {
      pos[id] = { x, y: i * V_GAP + 40 };
    });
  }
  return pos;
}

// ---- Main component --------------------------------------------------------

function NodeDetail({ node }: { node: ArchNode }) {
  return (
    <div className="card w-72 space-y-3">
      <p className="font-mono text-xs font-semibold text-content break-all">{node.path}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {[
          ["Language",    node.language ?? "—"],
          ["Lines",       node.loc.toLocaleString()],
          ["Functions",   node.num_functions],
          ["Classes",     node.num_classes],
          ["Depends on",  node.dependency_count],
          ["Dependents",  node.dependent_count],
          ["Type",        node.is_test ? "test" : "source"],
        ].map(([k, v]) => (
          <>
            <dt key={`${k}-k`} className="text-content-faint">{k}</dt>
            <dd key={`${k}-v`} className="font-medium text-content">{String(v)}</dd>
          </>
        ))}
      </dl>
    </div>
  );
}

export function ArchitecturePage() {
  const { selected } = useRepository();
  const [arch, setArch] = useState<Architecture | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (conn: Connection) => setRfEdges((eds) => addEdge(conn, eds)),
    [setRfEdges],
  );

  useEffect(() => {
    if (!selected) { setArch(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getArchitecture(selected.id)
      .then((a) => { if (!cancelled) setArch(a); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Load failed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  // Cap displayed nodes for performance in very large repos
  const MAX_NODES = 200;

  const visibleNodes = useMemo(() => {
    if (!arch) return [];
    // Prefer nodes with higher connectivity (more interesting)
    return [...arch.nodes]
      .sort((a, b) => (b.dependency_count + b.dependent_count) - (a.dependency_count + a.dependent_count))
      .slice(0, MAX_NODES);
  }, [arch]);

  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  useEffect(() => {
    if (!arch || visibleNodes.length === 0) { setRfNodes([]); setRfEdges([]); return; }

    const visEdges = arch.edges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
    );
    const pos = layoutNodes(visibleNodes, visEdges);

    const nodes: Node[] = visibleNodes.map((n) => ({
      id: n.id,
      position: pos[n.id] ?? { x: 0, y: 0 },
      data: { label: n.path.split("/").pop() ?? n.path, archNode: n },
      style: {
        background: nodeColor(n.language, n.is_test),
        color: "#fff",
        border: "none",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 11,
        fontFamily: "monospace",
        minWidth: 120,
        maxWidth: 220,
        opacity: n.is_test ? 0.65 : 1,
        cursor: "pointer",
      },
    }));

    const edges: Edge[] = visEdges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      style: { stroke: "#334155", strokeWidth: 1 },
      animated: false,
    }));

    setRfNodes(nodes);
    setRfEdges(edges);
  }, [arch, visibleNodes, visibleIds, setRfNodes, setRfEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const archNode = node.data?.archNode as ArchNode | undefined;
      setSelectedNode(archNode ?? null);
    },
    [],
  );

  if (!selected) {
    return (
      <div className="card text-sm text-content-muted">
        Select a repository to view its architecture.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Architecture</h1>
          <p className="mt-1 text-sm text-content-muted">
            Dependency graph built from resolved imports. Click a node for details.
          </p>
        </div>
        {arch && (
          <div className="flex gap-4 text-xs text-content-faint shrink-0">
            <span>{arch.nodes.length} files</span>
            <span>{arch.edges.length} edges</span>
            {arch.circular_dependencies.length > 0 && (
              <span className="text-risk-medium">
                {arch.circular_dependencies.length} cycle{arch.circular_dependencies.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-content-faint">
          <span className="animate-spin">⟳</span> Loading graph…
        </div>
      )}
      {error && (
        <div className="card border-risk-high/30 bg-risk-high/10 text-sm text-risk-high">{error}</div>
      )}

      {arch && arch.nodes.length === 0 && (
        <div className="card text-sm text-content-muted">
          No files found. Run "Analyse Repository" first.
        </div>
      )}

      {arch && arch.nodes.length > MAX_NODES && (
        <div className="rounded-lg border border-risk-medium/30 bg-risk-medium/10 px-4 py-2 text-xs text-risk-medium">
          Showing top {MAX_NODES} of {arch.nodes.length} files by connectivity. All edges are preserved for shown nodes.
        </div>
      )}

      {/* Circular dependency warnings */}
      {arch && arch.circular_dependencies.length > 0 && (
        <div className="card border-risk-medium/30 bg-risk-medium/[0.05]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-risk-medium">
            Circular dependencies detected — {arch.circular_dependencies.length} cycle{arch.circular_dependencies.length !== 1 ? "s" : ""}
          </p>
          <p className="mb-3 text-xs text-content-faint">
            Structural finding, not automatically a bug. Cycles can increase coupling and make testing harder.
          </p>
          <div className="space-y-2">
            {arch.circular_dependencies.slice(0, 5).map((cd, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1 font-mono text-[11px] text-content-muted">
                {cd.cycle.map((path, j) => (
                  <span key={j} className="flex items-center gap-1">
                    <span className="rounded bg-bg-elevated px-1.5 py-0.5">{path.split("/").pop()}</span>
                    {j < cd.cycle.length - 1 && <span className="text-content-faint">→</span>}
                  </span>
                ))}
              </div>
            ))}
            {arch.circular_dependencies.length > 5 && (
              <p className="text-xs text-content-faint">
                …and {arch.circular_dependencies.length - 5} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Graph + detail panel */}
      {arch && arch.nodes.length > 0 && (
        <div className="flex gap-4">
          <div
            className="flex-1 overflow-hidden rounded-xl border border-border"
            style={{ height: 560 }}
          >
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={handleNodeClick}
              fitView
              fitViewOptions={{ padding: 0.1 }}
              minZoom={0.1}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color="rgb(34 41 54)"
              />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={(n) => {
                  const an = n.data?.archNode as ArchNode | undefined;
                  return nodeColor(an?.language ?? null, an?.is_test ?? false);
                }}
                style={{ background: "rgb(15 18 25)", border: "1px solid rgb(34 41 54)" }}
              />
            </ReactFlow>
          </div>

          {selectedNode && (
            <div className="shrink-0">
              <NodeDetail node={selectedNode} />
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-content-faint">
        {Object.entries(LANG_COLOR).map(([lang, color]) => (
          <span key={lang} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
            {lang}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#8aa29e]" />
          test
        </span>
      </div>
    </div>
  );
}
