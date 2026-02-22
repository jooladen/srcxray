'use client';

import { useMemo, useState, Fragment } from 'react';
import type { AnalysisResult } from '@/lib/parser';
import { buildFlowGraph, groupByKind, edgesFrom, edgesTo } from '@/lib/flow';
import type { FlowNode, FlowGraph } from '@/lib/flow';

const KIND_META: Record<FlowNode['kind'], { label: string; color: string; dot: string; bg: string }> = {
  prop:   { label: 'Props (입력)',   color: 'border-indigo-300 text-indigo-700', bg: 'bg-indigo-50',  dot: '🔵' },
  state:  { label: 'State (상태)',   color: 'border-blue-300 text-blue-700',    bg: 'bg-blue-50',    dot: '⚡' },
  effect: { label: 'Effect (자동화)', color: 'border-orange-300 text-orange-700', bg: 'bg-orange-50',dot: '🔄' },
  jsx:    { label: 'JSX (화면)',     color: 'border-green-300 text-green-700',  bg: 'bg-green-50',   dot: '🖥️' },
};

const EDGE_LABEL_COLORS: Record<string, string> = {
  '초기값 전달': 'bg-indigo-100 text-indigo-600',
  '변화 감지':   'bg-blue-100 text-blue-600',
  '상태 업데이트': 'bg-orange-100 text-orange-600',
  '화면 렌더링': 'bg-green-100 text-green-600',
};

function NodeCard({
  node,
  graph,
  highlighted,
  onHover,
}: {
  node: FlowNode;
  graph: FlowGraph;
  highlighted: Set<string>;
  onHover: (ids: Set<string> | null) => void;
}) {
  const meta      = KIND_META[node.kind];
  const isHover   = highlighted.has(node.id);
  const fromEdges = edgesFrom(graph, node.id);
  const toEdges   = edgesTo(graph, node.id);
  const connected = new Set([
    ...fromEdges.map(e => e.to),
    ...toEdges.map(e => e.from),
    node.id,
  ]);

  return (
    <div
      className={`border-2 rounded-xl px-3 py-2 text-xs font-mono font-semibold cursor-default transition-all select-none
        ${meta.bg} ${meta.color}
        ${isHover ? 'shadow-md scale-105 ring-2 ring-offset-1 ring-blue-400' : 'hover:shadow-sm hover:scale-102'}
      `}
      onMouseEnter={() => onHover(connected)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex items-center gap-1.5">
        <span>{node.label}</span>
        {node.line && <span className="opacity-40 font-normal">L{node.line}</span>}
      </div>
      {/* Outgoing edge labels */}
      {fromEdges.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {fromEdges.map((e, i) => (
            <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-full font-sans font-medium
              ${EDGE_LABEL_COLORS[e.label] ?? 'bg-gray-100 text-gray-500'}`}>
              → {e.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function EdgeSummaryRow({ graph }: { graph: FlowGraph }) {
  if (graph.edges.length === 0) return null;

  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="bg-gray-50 border-b px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide">
        🔗 연결 관계 ({graph.edges.length}개)
      </div>
      <div className="divide-y">
        {graph.edges.map((edge, i) => {
          const from = nodeMap.get(edge.from);
          const to   = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const fromMeta = KIND_META[from.kind];
          const toMeta   = KIND_META[to.kind];
          return (
            <div key={i} className="flex items-center gap-2 px-4 py-2 text-xs hover:bg-gray-50 transition-colors">
              <span className={`px-2 py-0.5 rounded border font-mono font-semibold ${fromMeta.bg} ${fromMeta.color}`}>
                {fromMeta.dot} {from.label}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                ${EDGE_LABEL_COLORS[edge.label] ?? 'bg-gray-100 text-gray-500'}`}>
                ──{edge.label}──▶
              </span>
              <span className={`px-2 py-0.5 rounded border font-mono font-semibold ${toMeta.bg} ${toMeta.color}`}>
                {toMeta.dot} {to.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FlowDiagram({ result }: { result: AnalysisResult }) {
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  const graph   = useMemo(() => buildFlowGraph(result), [result]);
  const grouped = useMemo(() => groupByKind(graph), [graph]);

  const comp = result.components[0];
  if (!comp) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>컴포넌트가 없어 흐름도를 생성할 수 없습니다.</p>
      </div>
    );
  }

  const COLUMNS: FlowNode['kind'][] = ['prop', 'state', 'effect', 'jsx'];

  return (
    <div className="space-y-5">
      {/* Component being analyzed */}
      {result.components.length > 0 && (
        <div className="text-xs text-gray-500">
          분석 대상: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-blue-700">{comp.name}</code>
          {result.components.length > 1 && (
            <span className="ml-1 text-gray-400">(컴포넌트 {result.components.length}개 중 첫 번째)</span>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {COLUMNS.map(k => (
          <span key={k} className={`flex items-center gap-1.5 border-2 rounded-full px-3 py-1 ${KIND_META[k].bg} ${KIND_META[k].color}`}>
            {KIND_META[k].dot} {KIND_META[k].label}
          </span>
        ))}
        <span className="text-gray-400 text-xs ml-2 self-center">
          · 노드에 hover하면 연결 관계가 강조됩니다
        </span>
      </div>

      {/* Node columns — arrows are siblings at the outer flex-row level */}
      <div className="flex flex-col sm:flex-row items-start gap-2 overflow-x-auto">
        {COLUMNS.map((kind, ci) => (
          <Fragment key={kind}>
            <div className="flex sm:flex-col items-center sm:items-start gap-2 flex-1 min-w-0">
              {/* Column header */}
              <div className={`text-xs font-bold uppercase tracking-wide shrink-0 px-2 py-1 rounded-lg ${KIND_META[kind].bg} ${KIND_META[kind].color}`}>
                {KIND_META[kind].dot} {kind === 'prop' ? 'Props' : kind === 'state' ? 'State' : kind === 'effect' ? 'Effect' : 'JSX'}
              </div>

              {/* Nodes */}
              <div className="flex sm:flex-col gap-1.5 flex-wrap sm:flex-nowrap w-full">
                {grouped[kind].length > 0
                  ? grouped[kind].map(node => (
                      <NodeCard
                        key={node.id}
                        node={node}
                        graph={graph}
                        highlighted={highlighted}
                        onHover={ids => setHighlighted(ids ?? new Set())}
                      />
                    ))
                  : <span className="text-xs text-gray-300 italic px-2">없음</span>
                }
              </div>
            </div>

            {/* Column arrow between columns — at the outer flex-row level */}
            {ci < COLUMNS.length - 1 && (
              <div className="hidden sm:flex items-center mt-8 text-gray-300 text-xl shrink-0">
                →
              </div>
            )}
          </Fragment>
        ))}
      </div>

      {/* Edge Summary Table */}
      <EdgeSummaryRow graph={graph} />

      <div className="text-xs text-gray-400 border-t pt-3">
        💡 <strong>읽는 법:</strong>&nbsp;
        🔵 Props → ⚡ State → 🔄 Effect → 🖥️ JSX 순으로 데이터가 흘러갑니다.
        State가 바뀌면 Effect가 반응하고, JSX가 다시 그려집니다.
      </div>
    </div>
  );
}
