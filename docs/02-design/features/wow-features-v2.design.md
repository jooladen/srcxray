# Design: wow-features-v2 — 왕초보 물개박수 기능 2차

**작성일**: 2026-02-22
**Plan 참조**: `docs/01-plan/features/wow-features-v2.plan.md`

---

## 구현 파일 목록

```
신규 생성:
  src/lib/samples.ts            ← F-07 샘플 코드 데이터
  src/components/HookCards.tsx  ← F-10 훅 번역 카드 탭

수정:
  src/app/page.tsx              ← F-07 샘플 버튼 + F-09 카운트업
  src/components/LearningGuide.tsx ← F-08 체크박스
  src/lib/tldr.ts               ← F-11 motivation 필드
  src/components/TldrCard.tsx   ← F-11 동기부여 카드 표시
  src/lib/complexity.ts         ← F-12 reasons 반환
  src/components/CodeHeatmap.tsx ← F-12 이유 툴팁
  src/lib/hook-explainer.ts     ← F-10 analogy 필드 추가
```

---

## F-07: 샘플 코드 즉시 분석 버튼

### 파일: `src/lib/samples.ts` (신규)

```typescript
export interface SampleCode {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  code: string;
}

export const SAMPLES: SampleCode[] = [
  {
    id: 'login',
    emoji: '🔐',
    title: '로그인 폼',
    desc: 'useState + form',
    code: `...`,  // 실제 샘플 TSX (아래 상세 정의)
  },
  {
    id: 'todo',
    emoji: '📋',
    title: '할일 목록',
    desc: 'useEffect + map',
    code: `...`,
  },
  {
    id: 'product',
    emoji: '🛒',
    title: '상품 카드',
    desc: 'props + 조건부',
    code: `...`,
  },
];
```

**샘플 코드 조건**:
- 각 50~80줄 (너무 짧으면 분석 가치 없음, 너무 길면 처음 보기 부담)
- 현실적인 패턴 (실제 프로젝트에서 보이는 코드)
- 초보자가 "아 이런 코드구나" 할 수 있는 수준

### 수정: `src/app/page.tsx`

빈 상태 섹션 교체:
```tsx
// 기존
{!result && !isLoading && (
  <div className="text-center py-16 ...">
    ...
    <p>샘플 코드로 먼저 테스트해볼 수 있습니다</p>
  </div>
)}

// 변경 후
{!result && !isLoading && (
  <div className="text-center py-12 ...">
    <div className="text-6xl mb-4">🔬</div>
    <p ...>TSX 파일을 업로드하거나 코드를 붙여넣기 하세요</p>

    {/* 샘플 버튼 */}
    <div className="mt-6">
      <p className="text-sm text-gray-500 mb-3">또는 샘플로 바로 체험해보세요 👇</p>
      <div className="flex gap-3 justify-center flex-wrap">
        {SAMPLES.map(s => (
          <button key={s.id}
            onClick={() => handleAnalyze(s.code, s.title + '.tsx')}
            className="...hover:scale-105 transition-transform...">
            <span>{s.emoji}</span>
            <div>
              <div className="font-bold">{s.title}</div>
              <div className="text-xs opacity-70">{s.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  </div>
)}
```

---

## F-08: LearningGuide 체크박스 인터랙션

### 수정: `src/components/LearningGuide.tsx`

**State 추가**:
```tsx
const [checked, setChecked] = useState<Set<number>>(new Set());

const toggle = (i: number) => setChecked(prev => {
  const next = new Set(prev);
  next.has(i) ? next.delete(i) : next.add(i);
  return next;
});

const allDone = checked.size === sections.length && sections.length > 0;
```

**진행 표시줄 수정** (`TimeBar` 위의 전체 바):
```tsx
// 기존: w-0 하드코딩
<div className="h-1.5 bg-blue-400 rounded-full w-0" />

// 변경: checked.size 기반 동적 width
<div
  className="h-1.5 bg-blue-400 rounded-full transition-all duration-500"
  style={{ width: `${sections.length ? (checked.size / sections.length) * 100 : 0}%` }}
/>
```

**섹션 카드에 체크박스 추가**:
```tsx
<div
  key={i}
  onClick={() => toggle(i)}
  className={`border rounded-xl p-4 cursor-pointer transition-all
    ${checked.has(i)
      ? 'border-green-400 bg-green-50 shadow-sm'
      : 'border-gray-200 hover:border-blue-300 bg-white'
    }`}
>
  {/* 체크 아이콘 */}
  <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center ...">
    {checked.has(i) ? '✅' : sec.order}
  </div>
  ...
</div>
```

**100% 완료 배너**:
```tsx
{allDone && (
  <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white
                  rounded-xl p-4 text-center animate-bounce-once">
    <div className="text-2xl mb-1">🎉</div>
    <p className="font-bold">와! 이 파일 완전히 파악했어요!</p>
    <p className="text-sm text-green-100">개발자 맞죠? 다음 파일도 분석해보세요!</p>
  </div>
)}
```

**중요**: `checked` state는 분석 결과가 바뀔 때 리셋 필요
→ `page.tsx`의 `handleAnalyze`에서 LearningGuide key 변경으로 처리 (또는 prop 전달)

---

## F-09: 통계 카운트업 애니메이션

### 수정: `src/app/page.tsx`

**useCountUp 훅 (page.tsx 내부 정의)**:
```tsx
function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(Math.round(eased * target));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}
```

**Stats 카드에 적용**:
```tsx
// 기존: value: result.totalLines 직접 표시
// 변경: useCountUp wrapper 컴포넌트

function AnimatedStat({ value, label, emoji, color }: ...) {
  const animated = useCountUp(value);
  return (
    <div className={`border rounded-xl p-4 text-center ${color}`}>
      <div className="text-2xl">{emoji}</div>
      <div className="text-2xl font-black tabular-nums">{animated}</div>
      <div className="text-xs font-medium opacity-70">{label}</div>
    </div>
  );
}
```

---

## F-10: 훅 번역 카드 탭

### 수정: `src/lib/hook-explainer.ts`

`HookExplanation` 인터페이스에 `analogy` 추가:
```typescript
export interface HookExplanation {
  plain: string;
  emoji: string;
  pattern: string;
  analogy: string;  // ← 신규: 왕초보용 비유
}
```

비유 예시:
```typescript
useState: {
  // 토글 케이스
  '토글/불리언': '전등 스위치 — 누를 때마다 켜지고 꺼져요',
  '로딩 상태':   '모래시계 — 기다리는 중인지 아닌지 표시해요',
  '검색 입력':   '검색창 — 입력한 글자를 기억해요',
  '목록 데이터': '장바구니 — 여러 아이템을 담아둬요',
  '숫자/카운트': '점수판 — 숫자를 세고 기억해요',
  '입력값':      '메모지 — 방금 입력한 내용을 기억해요',
}

useEffect: {
  '마운트 시 실행': '처음 문을 열 때 — 페이지 열리면 딱 한 번 실행',
  '값 변화 감지':   '도어벨 — 누군가 올 때(값이 바뀔 때)만 울려요',
  '항상 실행':      '심장박동 — 매 렌더링마다 계속 실행돼요',
}
```

### 신규: `src/components/HookCards.tsx`

```tsx
'use client';

import type { HookCall } from '@/lib/parser';
import { getHookExplanation } from '@/lib/hook-explainer';

const HOOK_COLORS = {
  useState:    'from-blue-50 to-blue-100 border-blue-200',
  useEffect:   'from-orange-50 to-orange-100 border-orange-200',
  useCallback: 'from-purple-50 to-purple-100 border-purple-200',
  useMemo:     'from-green-50 to-green-100 border-green-200',
  useRef:      'from-gray-50 to-gray-100 border-gray-200',
  useContext:  'from-yellow-50 to-yellow-100 border-yellow-200',
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
        const colorCls = HOOK_COLORS[hook.name as keyof typeof HOOK_COLORS]
                         ?? 'from-pink-50 to-pink-100 border-pink-200';
        return (
          <div key={i}
            className={`bg-gradient-to-br ${colorCls} border rounded-xl p-4`}>
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
            <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full font-semibold">
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
```

### 수정: `src/app/page.tsx`

TABS에 추가:
```tsx
{ key: 'hooks', label: '훅 번역', emoji: '⚡' },
```

TabKey 타입 업데이트:
```tsx
type TabKey = 'guide' | 'components' | 'flow' | 'imports' | 'functions' | 'heatmap' | 'hooks';
```

탭 카운트 뱃지:
```tsx
{tab.key === 'hooks' && (
  <span className="bg-gray-200 text-gray-600 text-xs px-1.5 rounded-full">
    {result.hooks.length}
  </span>
)}
```

탭 콘텐츠:
```tsx
{activeTab === 'hooks' && <HookCards hooks={result.hooks} />}
```

---

## F-11: "이 패턴으로 뭐 만들 수 있나요?" 카드

### 수정: `src/lib/tldr.ts`

`FileTldr`에 필드 추가:
```typescript
export interface FileTldr {
  summary: string;
  role: string[];
  badges: TldrBadge[];
  motivations: string[];  // ← 신규
}
```

`generateTldr()` 내 동기부여 문구 생성:
```typescript
const motivations: string[] = [];
if (hasForm && hasAuth)  motivations.push('🔐 회원가입·로그인 시스템');
if (hasForm)             motivations.push('📝 설문조사·문의 폼');
if (hasList && hasFetch) motivations.push('📰 뉴스 피드·상품 목록');
if (hasList && hasSearch)motivations.push('🔍 검색 기능 있는 앱');
if (hasModal)            motivations.push('💬 알림·팝업 UI');
if (hasRouter)           motivations.push('🗺️ 멀티페이지 앱');
if (hasFetch)            motivations.push('🌐 실시간 데이터 앱');
if (motivations.length === 0) motivations.push('🧩 재사용 가능한 UI 컴포넌트');

return { summary, role: roles, badges, motivations };
```

### 수정: `src/components/TldrCard.tsx`

TldrCard 하단에 섹션 추가:
```tsx
{tldr.motivations.length > 0 && (
  <div className="mt-3 pt-3 border-t border-white/20">
    <div className="text-blue-200 text-xs font-semibold mb-1.5">
      📌 이 패턴 마스터하면 만들 수 있어요 →
    </div>
    <div className="flex flex-wrap gap-1.5">
      {tldr.motivations.map((m, i) => (
        <span key={i}
          className="text-xs bg-white/20 hover:bg-white/30 transition-colors
                     px-2.5 py-1 rounded-full font-medium cursor-default">
          {m}
        </span>
      ))}
    </div>
  </div>
)}
```

---

## F-12: 복잡도 히트맵 "왜 복잡한가요?" 툴팁

### 수정: `src/lib/complexity.ts`

`LineScore`에 `reasons` 추가:
```typescript
export interface LineScore {
  score: number;
  borderColor: string;
  bgColor: string;
  label: string;
  reasons: string[];  // ← 신규
}
```

`getComplexityReasons(line: string): string[]` 함수 추가:
```typescript
export function getComplexityReasons(line: string): string[] {
  const trimmed = line.trimStart();
  const reasons: string[] = [];

  const indent = line.length - trimmed.length;
  if (indent >= 6) reasons.push(`들여쓰기 ${indent/2}단계 — 중첩이 깊어요`);

  if (/\basync\b/.test(trimmed)) reasons.push('async — 비동기 처리');
  if (/\bawait\b/.test(trimmed)) reasons.push('await — 결과를 기다려요');

  const ternaries = (trimmed.match(/\?(?!\.)/g) ?? []).length;
  if (ternaries >= 2) reasons.push(`삼항연산자 ${ternaries}개 — 조건이 겹겹이`);
  else if (ternaries === 1) reasons.push('삼항연산자 — A면 B, 아니면 C');

  const logicals = (trimmed.match(/&&|\|\|/g) ?? []).length;
  if (logicals > 0) reasons.push(`논리연산자 ${logicals}개 — 조건이 복잡해요`);

  const arrows = (trimmed.match(/=>/g) ?? []).length;
  if (arrows > 1) reasons.push(`화살표함수 ${arrows}개 — 함수 안에 함수`);

  const hooks = (trimmed.match(/\buse[A-Z]\w+\s*\(/g) ?? []).length;
  if (hooks > 0) reasons.push(`훅 호출 ${hooks}개`);

  if (/\btry\s*\{|\bcatch\s*\(/.test(trimmed)) reasons.push('try-catch — 에러 처리');

  return reasons;
}
```

`scoreLineComplexity`와 함께 `getLineScore`에서 `reasons` 포함:
```typescript
export function getLineScoreWithReasons(score: number, line: string): LineScore {
  const reasons = getComplexityReasons(line);
  const base = getLineScore(score);
  return { ...base, reasons };
}
```

### 수정: `src/components/CodeHeatmap.tsx`

CodeHeatmap에서 `getLineScoreWithReasons` 사용:
```tsx
const { score, reasons } = getLineScoreWithReasons(scores[i], line);

// 툴팁 개선
{isHovered && score > 2 && (  // 복잡 이상일 때만
  <div className="absolute right-0 z-10 bg-gray-900 text-white text-xs
                  rounded-lg px-3 py-2 shadow-lg max-w-48 whitespace-normal">
    <div className="font-bold mb-1">{ls.label} ({score}점)</div>
    {reasons.map((r, i) => (
      <div key={i} className="opacity-80">• {r}</div>
    ))}
    {reasons.length === 0 && <div className="opacity-60">들여쓰기가 깊어요</div>}
  </div>
)}
```

---

## 구현 순서

```
1. src/lib/samples.ts              (신규 — 독립적)
2. src/app/page.tsx 빈 화면 수정   (F-07, F-09)
3. src/lib/complexity.ts 수정      (F-12 기반)
4. src/components/CodeHeatmap.tsx  (F-12)
5. src/lib/tldr.ts 수정            (F-11 기반)
6. src/components/TldrCard.tsx     (F-11)
7. src/lib/hook-explainer.ts 수정  (F-10 기반)
8. src/components/HookCards.tsx    (신규 — F-10)
9. src/app/page.tsx 탭 추가        (F-10)
10. src/components/LearningGuide.tsx (F-08)
```

---

## 데이터 흐름 요약

```
page.tsx
  ├─ SAMPLES → handleAnalyze() → [F-07]
  ├─ AnimatedStat (useCountUp) → [F-09]
  ├─ TldrCard ← FileTldr.motivations ← [F-11]
  ├─ HookCards ← result.hooks ← [F-10]
  ├─ LearningGuide (체크박스 state) ← [F-08]
  └─ CodeHeatmap ← getLineScoreWithReasons ← [F-12]
```

---

## 체크리스트

- [ ] F-07: 샘플 3개 (로그인/할일/상품카드) 구현 완료
- [ ] F-08: 체크박스 클릭 → 진행바 변화 확인
- [ ] F-08: 100% 완료 시 축하 배너 표시
- [ ] F-09: 통계 숫자 카운트업 (0→목표값, 0.6초)
- [ ] F-10: 훅 번역 탭 클릭 → 훅 카드 목록 표시
- [ ] F-10: 비유(analogy) 텍스트 각 훅별 표시
- [ ] F-11: TldrCard에 "만들 수 있어요 →" 동기부여 표시
- [ ] F-12: 복잡한 줄 hover → 이유 목록 툴팁 표시
