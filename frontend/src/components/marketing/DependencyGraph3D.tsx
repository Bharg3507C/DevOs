import { useEffect, useRef } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";

// A self-contained, dependency-free 3D dependency-graph visualisation.
// Nodes live in 3D space, slowly rotate around the Y axis, are perspective-
// projected to 2D, and connected by edges. It evokes exactly what DevOS builds:
// a knowledge graph of a codebase. No WebGL library needed; it draws to a 2D
// canvas so the bundle stays small and it degrades gracefully.

interface Node3D {
  x: number;
  y: number;
  z: number;
  r: number;
  hue: number;
}

interface Edge {
  a: number;
  b: number;
}

function buildGraph(count: number): { nodes: Node3D[]; edges: Edge[] } {
  const nodes: Node3D[] = [];
  // Distribute points on a sphere (Fibonacci sphere) for an even, organic look.
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const scale = 150;
    nodes.push({
      x: Math.cos(theta) * radius * scale,
      y: y * scale,
      z: Math.sin(theta) * radius * scale,
      r: 2 + Math.random() * 3,
      hue: 210 + Math.random() * 40, // blue-ish accent range
    });
  }
  // Connect each node to a couple of nearest neighbours to form a graph.
  const edges: Edge[] = [];
  for (let i = 0; i < count; i++) {
    const dists: { j: number; d: number }[] = [];
    for (let j = 0; j < count; j++) {
      if (i === j) continue;
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dz = nodes[i].z - nodes[j].z;
      dists.push({ j, d: dx * dx + dy * dy + dz * dz });
    }
    dists.sort((p, q) => p.d - q.d);
    for (let k = 0; k < 2; k++) {
      const j = dists[k].j;
      if (i < j) edges.push({ a: i, b: j });
    }
  }
  return { nodes, edges };
}

export function DependencyGraph3D({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;

    const { nodes, edges } = buildGraph(48);
    let raf = 0;
    let angle = 0;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function project(n: Node3D, a: number) {
      // Rotate around Y then apply a fixed tilt around X for depth.
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const rx = n.x * cos - n.z * sin;
      const rz = n.x * sin + n.z * cos;
      const tilt = 0.35;
      const ry = n.y * Math.cos(tilt) - rz * Math.sin(tilt);
      const rzz = n.y * Math.sin(tilt) + rz * Math.cos(tilt);
      const perspective = 420 / (420 + rzz);
      return {
        sx: width / 2 + rx * perspective,
        sy: height / 2 + ry * perspective,
        scale: perspective,
        depth: rzz,
      };
    }

    function frame() {
      ctx.clearRect(0, 0, width, height);
      const projected = nodes.map((n) => project(n, angle));

      // Edges first, faded by depth.
      for (const e of edges) {
        const p = projected[e.a];
        const q = projected[e.b];
        const alpha = 0.05 + Math.max(0, (p.scale + q.scale) / 2 - 0.6) * 0.5;
        ctx.strokeStyle = `rgba(79, 140, 255, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy);
        ctx.lineTo(q.sx, q.sy);
        ctx.stroke();
      }

      // Nodes on top, sized and brightened by depth.
      const order = projected
        .map((p, i) => ({ p, i }))
        .sort((a, b) => a.p.depth - b.p.depth);
      for (const { p, i } of order) {
        const n = nodes[i];
        const radius = n.r * p.scale;
        const light = Math.min(1, 0.4 + p.scale * 0.6);
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${n.hue}, 90%, ${Math.round(light * 65)}%, ${light})`;
        ctx.shadowColor = "rgba(79, 140, 255, 0.6)";
        ctx.shadowBlur = 8 * p.scale;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (!reduced) {
        angle += 0.0025; // slow, calm rotation
        raf = requestAnimationFrame(frame);
      }
    }

    resize();
    window.addEventListener("resize", resize);
    frame();
    // If reduced motion, render a single static frame at a pleasing angle.
    if (reduced) {
      angle = 0.6;
      frame();
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reduced]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} aria-hidden="true" className="h-full w-full" />
    </div>
  );
}
