'use client';

import type { AnalysisResult } from '@/lib/parser';

interface FlowNode {
  id: string;
  kind: 'prop' | 'state' | 'effect' | 'jsx';
  label: string;
  line?: number;
}

const KIND_META = {
  prop:   { label: 'Props (입력)',     color: 'bg-indigo-100 border-indigo-300 text-indigo-700', dot: '🔵' },
  state:  { label: 'State (상태)',     color: 'bg-blue-100 border-blue-300 text-blue-700',       dot: '⚡' },
  effect: { label: 'Effect (자동화)', color: 'bg-orange-100 border-orange-300 text-orange-700', dot: '🔄' },
  jsx:    { label: 'JSX (화면 출력)', color: 'bg-green-100 border-green-300 text-green-700',    dot: '🖥️' },
};

function buildFlowNodes(result: AnalysisResult): FlowNode[][] {
  const comp = result.components[0];
  if (!comp) return [[], [], [], []];

  const props: FlowNode[] = comp.props.slice(0, 5).map((p, i) => ({
    id: `prop-${i}`, kind: 'prop', label: p,
  }));

  const states: FlowNode[] = comp.hooks
    .filter(h => h.name === 'useState')
    .slice(0, 5)
    .map((h, i) => ({
      id: `state-${i}`, kind: 'state',
      label: h.stateVar ? `${h.stateVar}` : 'state',
      line: h.line,
    }));

  const effects: FlowNode[] = comp.hooks
    .filter(h => h.name === 'useEffect')
    .slice(0, 3)
    .map((h, i) => ({
      id: `effect-${i}`, kind: 'effect',
      label: h.deps ? `deps: ${h.deps}` : 'useEffect',
      line: h.line,
    }));

  const customHooks = comp.hooks
    .filter(h => !['useState', 'useEffect'].includes(h.name))
    .slice(0, 2)
    .map((h, i) => ({
      id: `custom-${i}`, kind: 'effect' as const,
      label: h.name, line: h.line,
    }));

  const jsxNodes: FlowNode[] = [
    ...comp.jsxTags
      .filter(t => t[0] === t[0].toUpperCase()) // custom components first
      .slice(0, 2)
      .map((t, i) => ({ id: `jsx-c${i}`, kind: 'jsx' as const, label: `<${t}>` })),
    ...comp.jsxTags
      .filter(t => t[0] !== t[0].toUpperCase())
      .slice(0, 3)
      .map((t, i) => ({ id: `jsx-h${i}`, kind: 'jsx' as const, label: `<${t}>` })),
  ].slice(0, 5);

  return [props, states, [...effects, ...customHooks], jsxNodes];
}

function NodeCard({ node }: { node: FlowNode }) {
  const meta = KIND_META[node.kind];
  return (
    <div className={`border rounded-lg px-3 py-1.5 text-xs font-mono font-semibold ${meta.color} whitespace-nowrap`}>
      {node.label}
      {node.line && <span className="ml-1.5 opacity-50 font-normal">L{node.line}</span>}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center px-1 text-gray-400 text-lg select-none">
      →
    </div>
  );
}

export default function FlowDiagram({ result }: { result: AnalysisResult }) {
  const comp = result.components[0];

  if (!comp) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>컴포넌트가 없어 흐름도를 생성할 수 없습니다.</p>
      </div>
    );
  }

  const [props, states, effects, jsxNodes] = buildFlowNodes(result);

  const columns = [
    { nodes: props,    key: 'prop'   as const },
    { nodes: states,   key: 'state'  as const },
    { nodes: effects,  key: 'effect' as const },
    { nodes: jsxNodes, key: 'jsx'    as const },
  ];

  const hasContent = columns.some(c => c.nodes.length > 0);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.entries(KIND_META) as [FlowNode['kind'], typeof KIND_META.prop][]).map(([k, m]) => (
          <span key={k} className={`flex items-center gap-1.5 border rounded-full px-3 py-1 ${m.color}`}>
            {m.dot} {m.label}
          </span>
        ))}
      </div>

      {/* Flow */}
      {hasContent ? (
        <div className="overflow-x-auto">
          <div className="flex items-start gap-0 min-w-max">
            {columns.map((col, ci) => (
              <div key={ci} className="flex items-start">
                {/* Column */}
                <div className="flex flex-col gap-2 min-w-28">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 text-center">
                    {KIND_META[col.key].dot} {col.key === 'prop' ? 'Props' : col.key === 'state' ? 'State' : col.key === 'effect' ? 'Effect' : 'JSX'}
                  </div>
                  {col.nodes.length > 0
                    ? col.nodes.map((node, ni) => <NodeCard key={ni} node={node} />)
                    : <div className="text-xs text-gray-300 italic text-center pt-2">없음</div>
                  }
                </div>
                {/* Arrow between columns */}
                {ci < columns.length - 1 && (
                  <div className="pt-7">
                    <Arrow />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-gray-400 text-sm">흐름 데이터가 부족합니다.</p>
      )}

      <div className="text-xs text-gray-400 border-t pt-3">
        💡 <strong>읽는 법:</strong> 왼쪽(Props)에서 오른쪽(JSX)으로 데이터가 흘러갑니다. State가 바뀌면 JSX가 다시 그려집니다.
      </div>
    </div>
  );
}
