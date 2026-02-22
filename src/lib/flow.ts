import type { AnalysisResult } from './parser';

export interface FlowNode {
  id: string;
  kind: 'prop' | 'state' | 'effect' | 'jsx';
  label: string;
  line?: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  label: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export function buildFlowGraph(result: AnalysisResult): FlowGraph {
  const comp = result.components[0];
  if (!comp) return { nodes: [], edges: [] };

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  // ── 1. Nodes ─────────────────────────────────────────

  const propNodes: FlowNode[] = comp.props.slice(0, 5).map((p, i) => ({
    id: `prop-${i}`, kind: 'prop', label: p,
  }));

  const stateHooks  = comp.hooks.filter(h => h.name === 'useState').slice(0, 5);
  const effectHooks = comp.hooks.filter(h => h.name === 'useEffect').slice(0, 3);
  const customHooks = comp.hooks
    .filter(h => !['useState', 'useEffect'].includes(h.name)).slice(0, 2);

  const stateNodes: FlowNode[] = stateHooks.map((h, i) => ({
    id: `state-${i}`, kind: 'state', label: h.stateVar ?? `state${i}`, line: h.line,
  }));

  const effectNodes: FlowNode[] = [
    ...effectHooks.map((h, i) => ({
      id: `eff-${i}`, kind: 'effect' as const,
      label: h.deps ? `useEffect[${h.deps}]` : 'useEffect',
      line: h.line,
    })),
    ...customHooks.map((h, i) => ({
      id: `cus-${i}`, kind: 'effect' as const, label: h.name, line: h.line,
    })),
  ];

  const jsxSet = [
    ...comp.jsxTags.filter(t => t[0] === t[0].toUpperCase()).slice(0, 2),
    ...comp.jsxTags.filter(t => t[0] !== t[0].toUpperCase()).slice(0, 3),
  ].slice(0, 5);
  const jsxNodes: FlowNode[] = jsxSet.map((t, i) => ({
    id: `jsx-${i}`, kind: 'jsx', label: `<${t}>`,
  }));

  nodes.push(...propNodes, ...stateNodes, ...effectNodes, ...jsxNodes);

  // ── 2. Edges ─────────────────────────────────────────

  // Rule A: prop → state  (이름 유사도 기반)
  for (const pn of propNodes) {
    for (const sn of stateNodes) {
      const p = pn.label.toLowerCase();
      const s = sn.label.toLowerCase();
      if (p === s || s.includes(p) || p.includes(s)) {
        edges.push({ from: pn.id, to: sn.id, label: '초기값 전달' });
      }
    }
  }

  // Rule B: state → effect  (deps에 state 변수명 포함)
  for (const en of effectNodes) {
    const hook = effectHooks.find((_, i) => `eff-${i}` === en.id);
    if (!hook?.deps) continue;
    for (const sn of stateNodes) {
      if (hook.deps.includes(sn.label)) {
        edges.push({ from: sn.id, to: en.id, label: '변화 감지' });
      }
    }
  }

  // Rule C: effect → state  (effect가 setter를 호출 → state 업데이트)
  for (const en of effectNodes.filter(e => e.id.startsWith('eff-'))) {
    const idx = parseInt(en.id.split('-')[1]);
    const hook = effectHooks[idx];
    if (!hook) continue;

    // setter가 있는 state 중 deps에 없는 것들 → effect가 업데이트한다고 추정
    for (const [si, sh] of stateHooks.entries()) {
      const sn = stateNodes[si];
      if (!sn) continue;
      const alreadyWatched = edges.some(e => e.from === sn.id && e.to === en.id);
      if (!alreadyWatched && sh.setterVar) {
        edges.push({ from: en.id, to: sn.id, label: '상태 업데이트' });
        break; // effect당 한 개만 (시각적 단순화)
      }
    }
  }

  // Rule D: state → jsx  (상태가 화면에 표시됨)
  if (jsxNodes.length > 0) {
    for (const sn of stateNodes) {
      edges.push({ from: sn.id, to: jsxNodes[0].id, label: '화면 렌더링' });
    }
  }

  // 엣지가 전혀 없으면 기본 체인 연결 (fallback)
  if (edges.length === 0) {
    const chain: FlowNode[][] = [propNodes, stateNodes, effectNodes, jsxNodes];
    for (let i = 0; i < chain.length - 1; i++) {
      if (chain[i].length > 0 && chain[i + 1].length > 0) {
        edges.push({ from: chain[i][0].id, to: chain[i + 1][0].id, label: '→' });
      }
    }
  }

  return { nodes, edges };
}

export function groupByKind(graph: FlowGraph): Record<FlowNode['kind'], FlowNode[]> {
  const g: Record<FlowNode['kind'], FlowNode[]> = { prop: [], state: [], effect: [], jsx: [] };
  for (const n of graph.nodes) g[n.kind].push(n);
  return g;
}

export function edgesFrom(graph: FlowGraph, nodeId: string): FlowEdge[] {
  return graph.edges.filter(e => e.from === nodeId);
}

export function edgesTo(graph: FlowGraph, nodeId: string): FlowEdge[] {
  return graph.edges.filter(e => e.to === nodeId);
}
