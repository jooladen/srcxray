'use client';

import { useState } from 'react';
import type { ConceptItem } from '@/lib/concept-finder';
import type { HookCall } from '@/lib/parser';

// ─── F-15: useEffect 타임라인 ─────────────────────────────────
function EffectTimeline({ hooks, onScrollToLine }: { hooks: HookCall[]; onScrollToLine?: (line: number) => void }) {
  const effects = hooks.filter(h => h.name === 'useEffect');
  if (effects.length === 0) return null;

  return (
    <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
      <h3 className="font-bold text-orange-800 text-sm mb-3">
        🕐 useEffect 실행 타임라인 — 언제 실행되나요?
      </h3>
      <div className="space-y-2">
        {effects.map((e, i) => {
          let icon = '🔁';
          let label = '매 렌더링마다 실행';
          let color = 'bg-gray-100 text-gray-700';
          if (e.deps === '[]') {
            icon = '🚀'; label = '마운트 시 딱 한 번만'; color = 'bg-blue-100 text-blue-700';
          } else if (e.deps) {
            const dep = e.deps.replace(/[\[\]\s]/g, '');
            icon = '👀'; label = `[${dep}]이 바뀔 때마다`; color = 'bg-purple-100 text-purple-700';
          }
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-lg">{icon}</span>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${color}`}>
                {label}
              </span>
              <button
                onClick={() => onScrollToLine?.(e.line)}
                className="text-xs text-blue-600 hover:underline hover:text-blue-800 transition-colors"
              >
                📍 {e.line}줄
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-orange-600 mt-2">
        💡 deps 배열이 핵심! 빈 배열 [] = 한 번만, 값 있음 = 값 바뀔 때, 없음 = 매번
      </p>
    </div>
  );
}

// ─── F-14: 필수 개념 카드 ─────────────────────────────────────
const LEVEL_BADGE = {
  3: { label: '⭐⭐⭐ 자다깨도 OK', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  2: { label: '⭐⭐ 중요',          color: 'bg-blue-100 text-blue-800 border-blue-300' },
  1: { label: '⭐ 알면 좋음',       color: 'bg-gray-100 text-gray-700 border-gray-300' },
};

// ─── F-16: 마스터 체크리스트 ─────────────────────────────────
function MasterChecklist({ concepts, checkedIds, onToggle }: {
  concepts: ConceptItem[];
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const allDone = concepts.length > 0 && concepts.every(c => checkedIds.has(c.id));
  const level3 = concepts.filter(c => c.level === 3);
  const level2 = concepts.filter(c => c.level === 2);
  const level1 = concepts.filter(c => c.level === 1);

  return (
    <div className="border border-dashed border-gray-300 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-700 text-sm">
          🏆 마스터 체크리스트 — 이것들 알면 이 파일 완전 이해!
        </h3>
        <span className="text-xs text-gray-400">{checkedIds.size}/{concepts.length} 알고 있어요</span>
      </div>

      {allDone && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-xl p-3 text-center mb-3">
          <div className="text-2xl mb-1">🎉</div>
          <p className="font-bold text-sm">이 파일 완전 마스터!</p>
        </div>
      )}

      {[
        { label: '⭐⭐⭐ 자다깨도 알아야 함', items: level3 },
        { label: '⭐⭐ 중요',                  items: level2 },
        { label: '⭐ 알면 좋음',              items: level1 },
      ].filter(g => g.items.length > 0).map(group => (
        <div key={group.label} className="mb-3">
          <p className="text-xs font-semibold text-gray-500 mb-1">{group.label}</p>
          {group.items.map(c => (
            <div
              key={c.id}
              onClick={() => onToggle(c.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all mb-1
                ${checkedIds.has(c.id) ? 'bg-green-50 text-green-700' : 'hover:bg-gray-50 text-gray-700'}`}
            >
              <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs shrink-0 transition-all
                ${checkedIds.has(c.id) ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}>
                {checkedIds.has(c.id) ? '✓' : ''}
              </span>
              <span className="mr-1">{c.emoji}</span>
              <span className="text-sm font-medium">{c.name}</span>
              <span className="text-xs text-gray-400 ml-auto">{c.lines.length}곳 발견</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function ConceptCards({
  concepts,
  hooks,
  onScrollToLine,
}: {
  concepts: ConceptItem[];
  hooks: HookCall[];
  onScrollToLine?: (line: number) => void;
}) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) => setCheckedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return next;
  });

  if (concepts.length === 0) {
    return <p className="text-center text-gray-400 py-8">분석된 필수 개념이 없습니다.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">
        이 파일에서 발견된 React 핵심 개념 <strong>{concepts.length}가지</strong>입니다.
      </p>

      {/* F-15: useEffect 타임라인 */}
      <EffectTimeline hooks={hooks} onScrollToLine={onScrollToLine} />

      {/* F-14: 필수 개념 카드 */}
      {concepts.map(concept => {
        const badge = LEVEL_BADGE[concept.level];
        const isExpanded = expanded === concept.id;
        const isChecked = checkedIds.has(concept.id);
        return (
          <div
            key={concept.id}
            className={`border rounded-xl transition-all cursor-pointer
              ${isChecked ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}
            onClick={() => setExpanded(isExpanded ? null : concept.id)}
          >
            <div className="flex items-center gap-3 p-4">
              <span className="text-2xl">{concept.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-800">{concept.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{concept.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-400">{concept.lines.length}곳</span>
                <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
                <div className="bg-yellow-50 rounded-lg px-3 py-2 text-sm">
                  🎯 <strong>비유:</strong> {concept.analogy}
                </div>
                <div className="text-xs text-gray-500 flex items-center flex-wrap gap-1">
                  <span className="font-semibold">이 파일에서:</span>
                  {concept.patternDesc} —
                  {concept.lines.slice(0, 5).map(l => (
                    <button
                      key={l}
                      onClick={e => { e.stopPropagation(); onScrollToLine?.(l); }}
                      className="text-blue-600 hover:underline hover:text-blue-800 transition-colors"
                    >
                      {l}줄
                    </button>
                  ))}
                  {concept.lines.length > 5 && ` 외 ${concept.lines.length - 5}개`}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); toggle(concept.id); }}
                  className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors
                    ${isChecked
                      ? 'bg-green-500 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {isChecked ? '✓ 알고 있어요!' : '이미 알아요! 체크'}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* F-16: 마스터 체크리스트 */}
      <MasterChecklist concepts={concepts} checkedIds={checkedIds} onToggle={toggle} />
    </div>
  );
}
