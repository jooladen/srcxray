'use client';

import type { ComponentInfo, HookCall } from '@/lib/parser';

function HookBadge({ hook }: { hook: HookCall }) {
  const colors: Record<string, string> = {
    useState:    'bg-blue-100 text-blue-700',
    useEffect:   'bg-orange-100 text-orange-700',
    useCallback: 'bg-purple-100 text-purple-700',
    useMemo:     'bg-green-100 text-green-700',
    useRef:      'bg-gray-100 text-gray-700',
    useContext:  'bg-yellow-100 text-yellow-700',
  };
  const cls = colors[hook.name] ?? 'bg-pink-100 text-pink-700';
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-mono ${cls}`}>
      {hook.name}
      {hook.stateVar && <span className="opacity-70">→ {hook.stateVar}</span>}
    </span>
  );
}

function ComponentCard({ component }: { component: ComponentInfo }) {
  const lineCount = component.endLine - component.startLine + 1;

  return (
    <div className="border-2 border-gray-200 hover:border-blue-300 rounded-xl p-4 transition-colors bg-white">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <span className="text-blue-600 font-bold font-mono text-lg">{component.name}</span>
          <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            {component.kind === 'arrow' ? '화살표 함수' : '일반 함수'}
          </span>
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {component.startLine}–{component.endLine}줄 ({lineCount}줄)
        </span>
      </div>

      {/* Props */}
      <div className="mb-2">
        <span className="text-xs font-semibold text-gray-500 mr-2">Props (입력값):</span>
        {component.props.length > 0
          ? component.props.map((p, i) => (
              <code key={i} className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded mr-1 font-mono">{p}</code>
            ))
          : <span className="text-xs text-gray-400">없음</span>
        }
      </div>

      {/* Hooks */}
      {component.hooks.length > 0 && (
        <div className="mb-2">
          <span className="text-xs font-semibold text-gray-500 mr-2">훅 (상태/효과):</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {component.hooks.map((h, i) => <HookBadge key={i} hook={h} />)}
          </div>
        </div>
      )}

      {/* JSX Tags */}
      {component.jsxTags.length > 0 && (
        <div>
          <span className="text-xs font-semibold text-gray-500 mr-2">사용 태그:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {component.jsxTags.slice(0, 12).map((tag, i) => {
              const isCustom = tag[0] === tag[0].toUpperCase();
              return (
                <span key={i} className={`text-xs px-2 py-0.5 rounded font-mono ${
                  isCustom ? 'bg-purple-50 text-purple-600 border border-purple-200' : 'bg-gray-100 text-gray-600'
                }`}>
                  {isCustom ? `<${tag}>` : `<${tag}>`}
                </span>
              );
            })}
            {component.jsxTags.length > 12 && (
              <span className="text-xs text-gray-400">+{component.jsxTags.length - 12}개</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComponentTree({ components }: { components: ComponentInfo[] }) {
  if (components.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <div className="text-4xl mb-2">🔍</div>
        <p>React 컴포넌트를 찾지 못했습니다.</p>
        <p className="text-sm mt-1">JSX를 반환하는 함수가 있는지 확인해보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {components.map((c, i) => <ComponentCard key={i} component={c} />)}
      <div className="text-xs text-gray-400 border-t pt-3 mt-2">
        💡 <strong>보라색 태그</strong>는 직접 만든 컴포넌트, <strong>회색 태그</strong>는 HTML 기본 요소입니다.
      </div>
    </div>
  );
}
