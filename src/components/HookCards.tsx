'use client';

import type { HookCall } from '@/lib/parser';
import { getHookExplanation } from '@/lib/hook-explainer';

const HOOK_COLORS: Record<string, string> = {
  useState:    'from-blue-50 to-blue-100 border-blue-200',
  useEffect:   'from-orange-50 to-orange-100 border-orange-200',
  useCallback: 'from-purple-50 to-purple-100 border-purple-200',
  useMemo:     'from-green-50 to-green-100 border-green-200',
  useRef:      'from-gray-50 to-gray-100 border-gray-200',
  useContext:  'from-yellow-50 to-yellow-100 border-yellow-200',
  useReducer:  'from-red-50 to-red-100 border-red-200',
};

export default function HookCards({ hooks }: { hooks: HookCall[] }) {
  if (hooks.length === 0) {
    return <p className="text-center text-gray-400 py-8">훅이 없는 파일입니다.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        이 파일이 사용하는 훅 <strong>{hooks.length}개</strong>를 쉬운 말로 설명합니다.
      </p>
      {hooks.map((hook, i) => {
        const exp = getHookExplanation(hook);
        const colorCls = HOOK_COLORS[hook.name] ?? 'from-pink-50 to-pink-100 border-pink-200';
        return (
          <div key={i} className={`bg-gradient-to-br ${colorCls} border rounded-xl p-4`}>
            {/* 훅 이름 + 라인 */}
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono font-bold text-sm">
                {exp.emoji} {hook.name}
                {hook.stateVar && (
                  <span className="opacity-60 font-normal"> — {hook.stateVar}</span>
                )}
              </span>
              {hook.line > 0 && (
                <span className="text-xs text-gray-400">📍 {hook.line}줄</span>
              )}
            </div>

            {/* 패턴 뱃지 */}
            <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full font-semibold text-gray-700">
              {exp.pattern}
            </span>

            {/* 쉬운 설명 */}
            <p className="text-sm mt-2 text-gray-700">{exp.plain}</p>

            {/* 비유 */}
            {exp.analogy && (
              <div className="mt-2 text-xs bg-white/50 rounded-lg px-3 py-2 text-gray-600">
                🎯 <strong>비유:</strong> {exp.analogy}
              </div>
            )}
          </div>
        );
      })}

      <div className="text-xs text-gray-400 border-t pt-3">
        💡 훅은 React 컴포넌트에서 상태·효과를 관리하는 특별한 함수입니다.
      </div>
    </div>
  );
}
