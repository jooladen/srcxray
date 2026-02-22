# Design: react-essentials — 왕초보 필수 React 지식 체험

**작성일**: 2026-02-22
**Plan 참조**: `docs/01-plan/features/react-essentials.plan.md`

---

## 구현 파일 목록

```
신규 생성:
  src/lib/danger-detector.ts      ← F-13 위험 신호 감지 엔진
  src/lib/concept-finder.ts       ← F-14 필수 개념 감지 엔진
  src/components/DangerCard.tsx   ← F-13 위험 신호 UI
  src/components/ConceptCards.tsx ← F-14+F-15+F-16 통합 UI

수정:
  src/app/page.tsx               ← 탭 2개 추가, 분석 파이프라인 연결
  src/components/TldrCard.tsx    ← 위험 신호 뱃지 추가
  src/lib/tldr.ts                ← FileTldr에 dangerCount 추가
```

---

## F-13: 위험 신호 감지기

### 파일: `src/lib/danger-detector.ts` (신규)

```typescript
import type { AnalysisResult } from './parser';

export type DangerLevel = 'high' | 'medium' | 'low';

export interface DangerItem {
  id: string;
  level: DangerLevel;
  emoji: string;
  title: string;
  description: string;   // "왜 위험한가요?" 한 줄
  solution: string;      // "어떻게 고치나요?" 한 줄
  lines: number[];       // 해당 줄 번호 (빈 배열이면 파일 전체)
}

export function detectDangers(code: string, result: AnalysisResult): DangerItem[] {
  const dangers: DangerItem[] = [];
  const lines = code.split('\n');

  // D-01: useEffect(async () => ...) — async 직접 사용
  lines.forEach((line, i) => {
    if (/useEffect\s*\(\s*async/.test(line)) {
      dangers.push({
        id: 'async-effect',
        level: 'medium',
        emoji: '🔄',
        title: 'useEffect에 async 직접 사용',
        description: '비동기 함수를 직접 전달하면 클린업이 불가능하고 메모리 누수가 생길 수 있어요',
        solution: 'useEffect 내부에 async 함수를 별도로 선언하고 호출하세요',
        lines: [i + 1],
      });
    }
  });

  // D-02: .map() 안에 key 없음
  lines.forEach((line, i) => {
    if (/\.map\s*\(/.test(line) && !/<.*key=/.test(line)) {
      // JSX를 반환하는 map인지 추가 확인 (return <, => <)
      const nearLines = lines.slice(i, i + 5).join('\n');
      if (/<[A-Za-z]/.test(nearLines) && !/key=/.test(nearLines)) {
        dangers.push({
          id: `map-no-key-${i}`,
          level: 'medium',
          emoji: '🔑',
          title: '.map()에 key prop 누락',
          description: 'React가 목록 항목을 구별 못해서 잘못된 곳이 업데이트되거나 버그가 생겨요',
          solution: '목록 최상위 요소에 고유한 key={item.id} 를 추가하세요',
          lines: [i + 1],
        });
      }
    }
  });

  // D-03: useEffect deps 없음 (무한루프 가능)
  const effectsWithNoDeps = result.hooks.filter(
    h => h.name === 'useEffect' && h.deps === undefined
  );
  const setterNames = result.hooks
    .filter(h => h.name === 'useState' && h.setterVar)
    .map(h => h.setterVar as string);

  effectsWithNoDeps.forEach(effect => {
    // 해당 useEffect 블록에서 setter 호출 여부 확인
    const effectArea = lines.slice(
      Math.max(0, effect.line - 1),
      effect.line + 15
    ).join('\n');
    const callsSetter = setterNames.some(s => effectArea.includes(s + '('));
    if (callsSetter) {
      dangers.push({
        id: `infinite-loop-${effect.line}`,
        level: 'high',
        emoji: '♾️',
        title: 'useEffect 무한 루프 위험',
        description: 'deps 없는 useEffect에서 setState를 호출하면 → 렌더링 → useEffect 실행 → setState ... 무한 반복!',
        solution: 'useEffect 두 번째 인수에 의존하는 값 배열 [] 을 추가하세요',
        lines: [effect.line],
      });
    }
  });

  // D-04: useState 5개 이상 — 커스텀 훅 분리 권장
  const stateCount = result.hooks.filter(h => h.name === 'useState').length;
  if (stateCount >= 5) {
    dangers.push({
      id: 'too-many-states',
      level: 'low',
      emoji: '🗂️',
      title: `useState ${stateCount}개 — 커스텀 훅 고려`,
      description: '상태가 너무 많으면 컴포넌트가 복잡해지고 관리하기 어려워요',
      solution: '관련 상태들을 custom hook으로 묶으면 코드가 깔끔해져요',
      lines: [],
    });
  }

  // D-05: console.log 잔존
  const consoleLines: number[] = [];
  lines.forEach((line, i) => {
    if (/console\.(log|warn|error)\s*\(/.test(line)) {
      consoleLines.push(i + 1);
    }
  });
  if (consoleLines.length > 0) {
    dangers.push({
      id: 'console-log',
      level: 'low',
      emoji: '📝',
      title: `console.log ${consoleLines.length}개 잔존`,
      description: '개발 중 디버깅 코드가 배포에 포함되면 성능에 영향을 줄 수 있어요',
      solution: '배포 전 console.log를 제거하거나 환경변수로 조건부 처리하세요',
      lines: consoleLines,
    });
  }

  // 중복 제거 (같은 id)
  return dangers.filter((d, i, arr) => arr.findIndex(x => x.id === d.id) === i);
}
```

### 파일: `src/components/DangerCard.tsx` (신규)

```tsx
'use client';

import type { DangerItem } from '@/lib/danger-detector';

const LEVEL_STYLE = {
  high:   { bg: 'bg-red-50 border-red-300',    badge: 'bg-red-100 text-red-700',    label: '🔴 높음' },
  medium: { bg: 'bg-yellow-50 border-yellow-300', badge: 'bg-yellow-100 text-yellow-700', label: '🟡 중간' },
  low:    { bg: 'bg-blue-50 border-blue-300',  badge: 'bg-blue-100 text-blue-700',  label: '🔵 낮음' },
};

export default function DangerCard({ dangers }: { dangers: DangerItem[] }) {
  if (dangers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-3">✅</div>
        <p className="text-lg font-bold text-green-700">위험 신호 없음!</p>
        <p className="text-sm text-gray-500 mt-1">이 파일에서 초보자 위험 패턴이 감지되지 않았어요.</p>
      </div>
    );
  }

  const high   = dangers.filter(d => d.level === 'high');
  const medium = dangers.filter(d => d.level === 'medium');
  const low    = dangers.filter(d => d.level === 'low');

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        총 <strong>{dangers.length}개</strong>의 주의 패턴을 발견했어요.
        {high.length > 0 && <span className="text-red-600 font-semibold ml-1">🔴 즉시 확인 필요 {high.length}개</span>}
      </p>

      <div className="space-y-3">
        {[...high, ...medium, ...low].map((d, i) => {
          const style = LEVEL_STYLE[d.level];
          return (
            <div key={i} className={`border rounded-xl p-4 ${style.bg}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{d.emoji}</span>
                  <span className="font-bold text-gray-800 text-sm">{d.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {d.lines.length > 0 && (
                    <span className="text-xs text-gray-500">
                      📍 {d.lines.slice(0, 3).map(l => `${l}줄`).join(', ')}
                      {d.lines.length > 3 && ` 외 ${d.lines.length - 3}개`}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${style.badge}`}>
                    {style.label}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 ml-8">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold text-gray-500">왜?</span> {d.description}
                </p>
                <p className="text-sm text-green-700 bg-white/60 rounded-lg px-2.5 py-1.5">
                  <span className="font-semibold">💡 해결:</span> {d.solution}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-gray-400 border-t pt-3">
        ⚠️ 이 감지는 정적 분석 기반으로, 실제 동작에 따라 위험하지 않을 수 있습니다.
      </div>
    </div>
  );
}
```

### 수정: `src/lib/tldr.ts`

`FileTldr`에 `dangerCount` 필드 추가:
```typescript
export interface FileTldr {
  summary: string;
  role: string[];
  badges: TldrBadge[];
  motivations: string[];
  dangerCount: number;   // ← 신규: 위험 신호 개수 (0이면 "✅ 안전")
}
```

`generateTldr` 시그니처 변경 (dangerCount는 page.tsx에서 주입):
```typescript
// generateTldr는 그대로 유지하되 dangerCount 기본값 0
return { summary, role: roles, badges, motivations, dangerCount: 0 };
```

page.tsx에서 분석 후 `setTldr(prev => ({ ...prev!, dangerCount: dangers.length }))` 로 업데이트

### 수정: `src/components/TldrCard.tsx`

`dangerCount` 뱃지 추가 (기존 badges 옆에):
```tsx
{/* 위험 신호 뱃지 */}
<div className="mt-2">
  {tldr.dangerCount === 0 ? (
    <span className="text-xs bg-green-500/30 border border-green-400/40 text-white px-2.5 py-1 rounded-full font-semibold">
      ✅ 위험 신호 없음
    </span>
  ) : (
    <span className="text-xs bg-red-500/30 border border-red-400/40 text-white px-2.5 py-1 rounded-full font-semibold">
      ⚠️ 위험 신호 {tldr.dangerCount}개
    </span>
  )}
</div>
```

---

## F-14 + F-15 + F-16: 필수 개념 카드 + useEffect 타임라인 + 마스터 체크리스트

### 파일: `src/lib/concept-finder.ts` (신규)

```typescript
import type { AnalysisResult } from './parser';

export interface ConceptItem {
  id: string;
  name: string;          // "조건부 렌더링"
  emoji: string;
  level: 1 | 2 | 3;    // 3 = 자다깨도 OK ⭐⭐⭐
  description: string;  // 한줄 핵심
  analogy: string;      // 비유
  lines: number[];      // 발견된 줄 번호 (최대 5개)
  patternDesc: string;  // "? : 패턴으로 발견"
}

const CONCEPT_DEFS = [
  {
    id: 'conditional-rendering',
    name: '조건부 렌더링',
    emoji: '🔀',
    level: 3 as const,
    description: '조건에 따라 다른 화면을 보여주는 핵심 패턴',
    analogy: '신호등 — 빨간불이면 멈추고, 초록불이면 가요',
    regex: /[^<]\?[^?.]|\s&&\s|\|\|/,
    patternDesc: '삼항연산자(? :) 또는 && 연산자로 발견',
  },
  {
    id: 'list-rendering',
    name: '목록 렌더링',
    emoji: '📋',
    level: 3 as const,
    description: '배열을 화면 목록으로 변환하는 필수 패턴',
    analogy: '복사기 — 같은 틀로 여러 장을 찍어내요',
    regex: /\.map\s*\(/,
    patternDesc: '.map()으로 발견',
  },
  {
    id: 'event-handler',
    name: '이벤트 핸들러',
    emoji: '👆',
    level: 3 as const,
    description: '사용자 행동(클릭, 입력 등)에 반응하는 함수',
    analogy: '초인종 — 누를 때만 반응해요',
    regex: /on(Click|Change|Submit|KeyDown|KeyPress|KeyUp|Focus|Blur|Mouse)\s*=/,
    patternDesc: 'onClick/onChange 등으로 발견',
  },
  {
    id: 'form-handling',
    name: '폼 처리',
    emoji: '📝',
    level: 2 as const,
    description: '사용자 입력을 받고 처리하는 HTML form 패턴',
    analogy: '설문지 — 작성하고 제출하는 흐름',
    regex: /e\.preventDefault\(\)|FormEvent|<form/,
    patternDesc: 'e.preventDefault() 또는 <form> 태그로 발견',
  },
  {
    id: 'async-await',
    name: '비동기 처리',
    emoji: '⏳',
    level: 2 as const,
    description: '서버 응답을 기다리는 동안 앱이 멈추지 않게 하는 패턴',
    analogy: '카페 주문 — 커피 만드는 동안 다른 일 할 수 있어요',
    regex: /\basync\b|\bawait\b/,
    patternDesc: 'async/await 키워드로 발견',
  },
  {
    id: 'spread-operator',
    name: '스프레드 연산자',
    emoji: '📤',
    level: 2 as const,
    description: '배열/객체를 펼쳐서 복사하거나 합치는 패턴',
    analogy: '도장 찍기 — 원본은 그대로, 복사본에 추가해요',
    regex: /\.\.\.(prev|state|item|data|obj|\w+)/,
    patternDesc: '...spread 패턴으로 발견',
  },
  {
    id: 'optional-chaining',
    name: '옵셔널 체이닝',
    emoji: '🔒',
    level: 1 as const,
    description: 'undefined/null일 때 안전하게 속성에 접근하는 패턴',
    analogy: '없으면 그냥 undefined — 오류 대신 조용히 넘어가요',
    regex: /\?\./,
    patternDesc: '?. 연산자로 발견',
  },
  {
    id: 'destructuring',
    name: '구조분해 할당',
    emoji: '📦',
    level: 2 as const,
    description: '객체/배열에서 원하는 값만 꺼내는 패턴',
    analogy: '택배 뜯기 — 박스에서 원하는 것만 꺼내요',
    regex: /const\s*\{[^}]+\}\s*=|const\s*\[[^\]]+\]\s*=/,
    patternDesc: '구조분해 패턴으로 발견',
  },
];

export function findConcepts(code: string, result: AnalysisResult): ConceptItem[] {
  const codeLines = code.split('\n');
  const found: ConceptItem[] = [];

  for (const def of CONCEPT_DEFS) {
    const matchedLines: number[] = [];
    codeLines.forEach((line, i) => {
      if (def.regex.test(line)) matchedLines.push(i + 1);
    });
    if (matchedLines.length > 0) {
      found.push({
        id: def.id,
        name: def.name,
        emoji: def.emoji,
        level: def.level,
        description: def.description,
        analogy: def.analogy,
        lines: matchedLines.slice(0, 5),
        patternDesc: def.patternDesc,
      });
    }
  }

  return found.sort((a, b) => b.level - a.level);  // 중요도 높은 것 먼저
}
```

### 파일: `src/components/ConceptCards.tsx` (신규)
*F-14 필수 개념 카드 + F-15 useEffect 타임라인 + F-16 마스터 체크리스트 통합*

```tsx
'use client';

import { useState } from 'react';
import type { ConceptItem } from '@/lib/concept-finder';
import type { HookCall } from '@/lib/parser';

// ─── F-15: useEffect 타임라인 ─────────────────────────────────
function EffectTimeline({ hooks }: { hooks: HookCall[] }) {
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
              <span className="text-xs text-gray-400">📍 {e.line}줄</span>
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
}: {
  concepts: ConceptItem[];
  hooks: HookCall[];
}) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) => setCheckedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
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
      <EffectTimeline hooks={hooks} />

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
                <div className="text-xs text-gray-500">
                  <span className="font-semibold">이 파일에서:</span>{' '}
                  {concept.patternDesc} — {concept.lines.slice(0, 5).map(l => `${l}줄`).join(', ')}
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
```

---

## 수정: `src/app/page.tsx`

### import 추가
```tsx
import { SAMPLES } from '@/lib/samples';
import type { DangerItem } from '@/lib/danger-detector';
import type { ConceptItem } from '@/lib/concept-finder';
const DangerCard    = dynamic(() => import('@/components/DangerCard'),    { ssr: false });
const ConceptCards  = dynamic(() => import('@/components/ConceptCards'),  { ssr: false });
```

### TabKey 타입 업데이트
```tsx
type TabKey = 'guide' | 'components' | 'flow' | 'imports' | 'functions' | 'heatmap' | 'hooks' | 'danger' | 'concepts';
```

### TABS 배열 업데이트 (위험신호 탭을 2번째 위치에)
```tsx
const TABS = [
  { key: 'guide',      label: '10분 가이드', emoji: '📚' },
  { key: 'danger',     label: '위험 신호',   emoji: '⚠️' },   // ← 신규
  { key: 'concepts',   label: '필수 개념',   emoji: '📖' },   // ← 신규
  { key: 'components', label: '컴포넌트',    emoji: '🧩' },
  { key: 'flow',       label: '데이터 흐름', emoji: '🌊' },
  { key: 'heatmap',    label: '복잡도 맵',   emoji: '🔥' },
  { key: 'hooks',      label: '훅 번역',     emoji: '⚡' },
  { key: 'imports',    label: 'Import 맵',   emoji: '📦' },
  { key: 'functions',  label: '함수 목록',   emoji: '🔧' },
];
```

### 상태 추가
```tsx
const [dangers,  setDangers]  = useState<DangerItem[]>([]);
const [concepts, setConcepts] = useState<ConceptItem[]>([]);
```

### handleAnalyze 업데이트
```tsx
const handleAnalyze = useCallback(async (inputCode: string, name: string) => {
  // ...기존 코드...
  const [{ analyzeCode }, { generateTldr }, { detectDangers }, { findConcepts }] = await Promise.all([
    import('@/lib/parser'),
    import('@/lib/tldr'),
    import('@/lib/danger-detector'),
    import('@/lib/concept-finder'),
  ]);

  const analysis = analyzeCode(inputCode);
  const fileTldr = generateTldr(analysis);
  const dangerItems  = detectDangers(inputCode, analysis);
  const conceptItems = findConcepts(inputCode, analysis);

  setResult(analysis);
  setTldr({ ...fileTldr, dangerCount: dangerItems.length });
  setDangers(dangerItems);
  setConcepts(conceptItems);
  // ...기존 코드...
}, []);
```

### 탭 뱃지 추가
```tsx
{tab.key === 'danger'   && dangers.length > 0  && <span className="bg-red-200 text-red-700 text-xs px-1.5 rounded-full">{dangers.length}</span>}
{tab.key === 'danger'   && dangers.length === 0 && <span className="bg-green-200 text-green-700 text-xs px-1.5 rounded-full">✓</span>}
{tab.key === 'concepts' && <span className="bg-gray-200 text-gray-600 text-xs px-1.5 rounded-full">{concepts.length}</span>}
```

### 탭 콘텐츠 추가
```tsx
{activeTab === 'danger'   && <DangerCard   dangers={dangers} />}
{activeTab === 'concepts' && <ConceptCards concepts={concepts} hooks={result.hooks} />}
```

---

## 구현 순서

```
1. src/lib/danger-detector.ts           (신규 — 독립)
2. src/lib/concept-finder.ts            (신규 — 독립)
3. src/lib/tldr.ts                      (dangerCount 필드 추가)
4. src/components/TldrCard.tsx          (위험신호 뱃지)
5. src/components/DangerCard.tsx        (신규)
6. src/components/ConceptCards.tsx      (신규 — F-14+F-15+F-16)
7. src/app/page.tsx                     (탭, 상태, handleAnalyze 확장)
```

---

## 데이터 흐름

```
page.tsx handleAnalyze()
  ├─ analyzeCode() → AnalysisResult
  ├─ detectDangers(code, result) → DangerItem[]  [F-13]
  ├─ findConcepts(code, result)  → ConceptItem[] [F-14]
  ├─ generateTldr(result) + dangerCount          [F-13 뱃지]
  │
  ├─ TldrCard ← dangerCount     [F-13 요약 뱃지]
  ├─ DangerCard ← dangers       [F-13 상세]
  └─ ConceptCards ← concepts + hooks
       ├─ EffectTimeline ← hooks [F-15]
       ├─ 개념 카드 목록          [F-14]
       └─ MasterChecklist        [F-16]
```

---

## 체크리스트

- [ ] F-13: 위험 신호 0개 파일 → "✅ 위험 신호 없음!" 표시
- [ ] F-13: async useEffect 감지 → 해당 줄 번호 표시
- [ ] F-13: TldrCard 위험신호 뱃지 표시
- [ ] F-14: 조건부 렌더링 감지 → 카드 표시
- [ ] F-14: 카드 클릭 → 비유 + 발견 줄 표시
- [ ] F-15: useEffect 3가지 시점 타임라인 표시
- [ ] F-16: "이미 알아요!" 체크 → 완료 표시
- [ ] F-16: 전체 체크 → "이 파일 완전 마스터!" 배너
