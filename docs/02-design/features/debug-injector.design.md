# Design: debug-injector — 토글형 console.log 자동 주입기

**작성일**: 2026-02-23
**레벨**: Dynamic
**참조 Plan**: `docs/01-plan/features/debug-injector.plan.md`

---

## 1. 아키텍처 개요

```
page.tsx (Home)
  ├─ code (원본 소스, string)          ← handleAnalyze 시 저장
  ├─ result (AnalysisResult)           ← parser.ts 결과
  │
  └─ DebugInjectorPanel              ← NEW (분석 결과 아래, 탭 위)
       ├─ [state] mode: original | injected
       ├─ [state] injectedSource: string
       ├─ [state] breakdown
       ├─ [state] animating + animatedCount (WOW-03)
       ├─ [state] executionSteps (WOW-01)
       └─ [state] logInput + timeline (WOW-05, v2)

lib/
  ├─ debug-injector.ts    ← 주입 엔진 + 스마트 라벨 + 실행순서 예측
  └─ log-parser.ts        ← 붙여넣기 로그 파싱 (WOW-05, v2)
```

### 데이터 흐름

```
[파일 로드 / 분석]
    ↓
handleAnalyze() → code(원본) + result(AST) 저장
    ↓
DebugInjectorPanel에 { code, result, fileName } props 전달
    ↓ (사용자가 버튼 클릭 전까지 아무것도 안 함)
[🔧 Log 주입하기] 클릭
    ↓
injectLogs(code, result) → { injectedSource, points, breakdown }
    ↓
predictExecutionOrder(result) → ExecutionStep[]
    ↓
애니메이션 (0~N 카운트업) → mode = 'injected'
    ↓
UI: 주입된 소스 + 실행 순서 예측 + 복사 버튼 표시

[↩ 원본으로 복귀] 클릭
    ↓
mode = 'original' (재계산 없음, originalSource는 props.code)
```

---

## 2. `src/lib/debug-injector.ts` 상세 설계

### 2.1 타입 정의

```typescript
'use client';

import type { AnalysisResult } from './parser';

export interface InjectionPoint {
  line: number;           // 삽입할 줄 (0-indexed)
  code: string;           // 마커 + console.log 블록
  category: 'props' | 'state' | 'effect' | 'handler' | 'render';
}

export interface InjectionBreakdown {
  props: number;
  state: number;
  effect: number;
  handler: number;
  render: number;
}

export interface InjectionResult {
  injectedSource: string;
  points: InjectionPoint[];
  breakdown: InjectionBreakdown;
  totalCount: number;
}

export interface ExecutionStep {
  order: number;
  line: number;
  category: InjectionPoint['category'];
  label: string;          // 화면에 표시할 한국어 설명
  note?: string;          // 괄호 안 보조 설명 ex) "(처음 한 번만)"
  phase: 'mount' | 'update' | 'event';
}
```

> **참고**: `parser.ts`의 `HookCall` 인터페이스에 `memoVar?: string` 필드가 추가되어
> `useMemo`/`useCallback` 선언 시 할당되는 변수명을 캡처합니다.
> 이를 통해 주입 엔진이 메모이제이션된 값의 로깅과 실행 순서 예측을 지원합니다.

### 2.2 스마트 한국어 라벨 매핑

```typescript
// 변수명 패턴 → 한국어 설명
const SMART_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^is[A-Z]|^has[A-Z]|loading|visible|open|active|enabled|checked|selected/i,
    label: '켜짐/꺼짐 상태' },
  { pattern: /count|index|num|total|size|length|page/i,
    label: '숫자 카운터' },
  { pattern: /email|password|token|auth|login|credential/i,
    label: '인증 입력값' },
  { pattern: /^data$|list|items|posts|users|products|results/i,
    label: '데이터 목록' },
  { pattern: /error|err|fail|exception/i,
    label: '에러 상태' },
  { pattern: /^user$|profile|^me$|account|member/i,
    label: '사용자 정보' },
  { pattern: /search|filter|query|keyword/i,
    label: '검색/필터' },
  { pattern: /modal|dialog|popup|drawer/i,
    label: '팝업 상태' },
  { pattern: /theme|dark|light|mode/i,
    label: '테마 설정' },
  { pattern: /input|value|field|text/i,
    label: '입력값' },
];

function getSmartLabel(varName: string): string {
  for (const { pattern, label } of SMART_LABELS) {
    if (pattern.test(varName)) return label;
  }
  return '';
}
```

### 2.3 마커 블록 생성

```typescript
// 삽입되는 코드 블록 형태
function makeMarker(line: number, logArgs: string, category: string): string {
  return [
    `  // @@SRCXRAY-START L:${line} category:${category}`,
    `  console.log(${logArgs});`,
    `  // @@SRCXRAY-END`,
  ].join('\n');
}
```

### 2.4 주입 위치 계산 (`buildInjectionPoints`)

```
AnalysisResult에서 추출:

ComponentInfo마다:
  ├─ startLine+1  → props log (컴포넌트 진입부 첫 줄)
  ├─ hooks[].line → useState: stateVar + smartLabel
  │                 useMemo: memoVar + smartLabel + deps 변수값 (state 카테고리)
  │                 useEffect: 내부 첫 줄 (line+1) + deps 변수값
  └─ endLine-1    → render log (return 직전)

FunctionItem마다 (isComponent=false):
  └─ startLine+1  → handler 진입 log
```

**deps 변수값 추출**: `parseDepsToVars(deps)` 헬퍼가 deps 문자열에서
단순 식별자(`count`, `name`)만 추출하고 복합 표현식(`items.length`)은 안전하게 건너뜁니다.

**주입 로그 형식 예시**:
```
useMemo:    console.log('[L:18][useMemo] filteredData =', filteredData, { items })
useEffect:  console.log('[L:20][useEffect] deps:[count, name] 시작', { count, name })
```

**핵심 규칙**: 동일 줄 중복 방지 (`Set<number>` dedup)

### 2.5 삽입 알고리즘 (`injectLogs`)

```typescript
export function injectLogs(source: string, result: AnalysisResult): InjectionResult {
  const points = buildInjectionPoints(source, result);

  // ⚠️ 핵심: 역순 정렬 후 삽입 → 앞 줄번호 밀림 방지
  const sorted = [...points].sort((a, b) => b.line - a.line);

  const lines = source.split('\n');
  for (const point of sorted) {
    const at = Math.max(0, Math.min(point.line, lines.length));
    lines.splice(at, 0, point.code);
  }

  return {
    injectedSource: lines.join('\n'),
    points,
    breakdown: calcBreakdown(points),
    totalCount: points.length,
  };
}
```

### 2.6 원복 (`removeInjectedLogs`)

```typescript
export function removeInjectedLogs(injectedSource: string): string {
  return injectedSource.replace(
    /[ \t]*\/\/ @@SRCXRAY-START[\s\S]*?\/\/ @@SRCXRAY-END\n?/g,
    ''
  );
}
// 또는 더 단순하게: originalSource(props.code)를 그냥 사용
```

### 2.7 실행 순서 예측 (`predictExecutionOrder`) — WOW-01

React 생명주기 순서에 따라 step 배열 생성:

```
Mount 단계:
  1. 컴포넌트 진입 (props)
  2. useState 초기화 (선언 순서대로)
  3. useMemo 계산 (선언 순서대로, render 전 동기 실행)
     - memoVar + smartLabel + deps 표시
  4. 첫 번째 render
  5. useEffect 실행 (render 이후)
     - deps=[] → "(처음 한 번만 — mount)"
     - deps=[x] → "(x 바뀔 때마다)"
     - deps 없음 → "(매 render 후)"

Update 단계 (점선 구분):
  6. set상태() 호출 → 상태 변경
  7. 재render
  8. useEffect 재실행 (해당 deps 변경 시)
```

```typescript
export function predictExecutionOrder(result: AnalysisResult): ExecutionStep[] {
  const steps: ExecutionStep[] = [];
  let order = 1;

  for (const comp of result.components) {
    // 1. Props
    if (comp.props.length > 0) {
      steps.push({
        order: order++, line: comp.startLine, category: 'props', phase: 'mount',
        label: `${comp.name} 시작 → props: ${comp.props.slice(0,3).join(', ')}`,
      });
    }

    // 2. useState (선언 순서)
    for (const h of comp.hooks.filter(h => h.name === 'useState')) {
      const sl = h.stateVar ? getSmartLabel(h.stateVar) : '';
      steps.push({
        order: order++, line: h.line, category: 'state', phase: 'mount',
        label: `${h.stateVar || '상태'} = 초기값${sl ? ` (${sl})` : ''}`,
      });
    }

    // 3. Render
    steps.push({
      order: order++, line: comp.endLine, category: 'render', phase: 'mount',
      label: `${comp.name} 첫 번째 render`,
    });

    // 4. useEffect
    for (const h of comp.hooks.filter(h => h.name === 'useEffect')) {
      const note =
        h.deps === '[]' ? '(처음 한 번만 — mount)' :
        h.deps           ? `(${h.deps} 바뀔 때마다)` :
                           '(매 render 후)';
      steps.push({
        order: order++, line: h.line, category: 'effect', phase: 'mount',
        label: `useEffect 실행 ${note}`, note,
      });
    }
  }

  // Update 단계 힌트 (첫 번째 setState 기준)
  const firstState = result.hooks.find(h => h.name === 'useState' && h.stateVar);
  if (firstState) {
    const sl = getSmartLabel(firstState.stateVar!);
    steps.push({
      order: order++, line: firstState.line, category: 'state', phase: 'update',
      label: `set${cap(firstState.stateVar!)}() → 상태 변경${sl ? ` (${sl})` : ''}`,
      note: '→ 재render 발생',
    });
  }

  return steps;
}
```

---

## 3. `src/components/DebugInjectorPanel.tsx` 상세 설계

### 3.1 Props

```typescript
interface Props {
  code: string;           // 원본 소스 (변경 불가)
  result: AnalysisResult; // AST 분석 결과
  fileName: string;       // 다운로드 파일명용
}
```

### 3.2 내부 State

```typescript
type Mode = 'original' | 'injected';

const [mode, setMode] = useState<Mode>('original');
const [injectedSource, setInjectedSource] = useState('');
const [breakdown, setBreakdown] = useState<InjectionBreakdown | null>(null);
const [totalCount, setTotalCount] = useState(0);
const [animating, setAnimating] = useState(false);
const [animatedCount, setAnimatedCount] = useState(0);  // WOW-03
const [steps, setSteps] = useState<ExecutionStep[]>([]);  // WOW-01
const [copied, setCopied] = useState(false);
// v2: WOW-05
// const [logInput, setLogInput] = useState('');
// const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
```

### 3.3 주입 핸들러 (`handleInject`)

```typescript
const handleInject = async () => {
  setAnimating(true);
  setAnimatedCount(0);

  // 실행 순서 예측 먼저 계산 (WOW-01)
  const executionSteps = predictExecutionOrder(result);
  setSteps(executionSteps);

  // 주입 계산 (동기, 빠름)
  const { injectLogs } = await import('@/lib/debug-injector');
  const injResult = injectLogs(code, result);

  // WOW-03: 카운트업 애니메이션 (500ms)
  const target = injResult.totalCount;
  const duration = 500;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    setAnimatedCount(Math.round(eased * target));
    if (t < 1) requestAnimationFrame(tick);
    else {
      setAnimating(false);
      setInjectedSource(injResult.injectedSource);
      setBreakdown(injResult.breakdown);
      setTotalCount(target);
      setMode('injected');
    }
  };
  requestAnimationFrame(tick);
};
```

### 3.4 복사 핸들러

```typescript
const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(injectedSource);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch { /* silent fail */ }
};
```

### 3.5 원본 백업 다운로드

```typescript
const handleDownloadOriginal = () => {
  const baseName = fileName.replace(/\.tsx?$/, '');
  const blob = new Blob([code], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.original.tsx`;
  a.click();
  URL.revokeObjectURL(url);
};
```

---

## 4. UI 레이아웃 설계

### 4.1 원본 모드 (기본)

```
┌──────────────────────────────────────────────────────┐
│  🔍 Debug 주입기                                       │
│  로딩된 소스에 console.log를 자동으로 넣어드려요        │
│                                    [🔧 Log 주입하기]  │
└──────────────────────────────────────────────────────┘
```

### 4.2 애니메이션 중 (WOW-03)

```
┌──────────────────────────────────────────────────────┐
│  🔧 주입 중...                                         │
│  ████████████████░░░░  8개                            │
└──────────────────────────────────────────────────────┘
```

### 4.3 주입 완료 모드

```
┌──────────────────────────────────────────────────────┐ ← 노란 테두리
│  🔧 Log 주입됨 ●                 [↩ 원본으로 복귀]    │
│  ✅ 12개 위치: props 2 · state 3 · effect 2 · fn 5   │
│  [📋 코드 복사]  [💾 원본 백업]                        │
├──────────────────────────────────────────────────────┤
│  🔮 이런 순서로 로그가 찍힐 거예요 (WOW-01)            │
│                                                      │
│  ── Mount 단계 ────────────────────────────          │
│  1️⃣  [L:12] MyComp 시작 → props: name, onClick        │
│  2️⃣  [L:15] count = 초기값 (숫자 카운터)               │
│  3️⃣  [L:45] isLoading = 초기값 (켜짐/꺼짐 상태)        │
│  4️⃣  [L:90] MyComp 첫 번째 render                     │
│  5️⃣  [L:20] useEffect 실행 (처음 한 번만 — mount)      │
│                                                      │
│  ── 상태 변경 후 ──────────────────────────          │
│  6️⃣  setCount() → 상태 변경 (숫자 카운터) → 재render   │
│  7️⃣  [L:90] MyComp 두 번째 render                     │
│                                                      │
├──────────────────────────────────────────────────────┤
│  📋 복사했으면 이렇게 하세요 (WOW-04)                   │
│                                                      │
│  Step 1. VSCode에서 원본 파일 열기                     │
│  Step 2. Ctrl+A → Ctrl+V  (주입된 코드 붙여넣기)       │
│  Step 3. npm run dev 실행                             │
│  Step 4. F12 → Console 탭 열기                        │
│  Step 5. 컴포넌트 사용해보기 → [L:숫자] 로그 확인 🎉   │
└──────────────────────────────────────────────────────┘
```

### 4.4 Tailwind 클래스 주요 설계

| 상태 | 컨테이너 클래스 |
|------|----------------|
| 원본 모드 | `border border-gray-200 rounded-2xl bg-white` |
| 주입 모드 | `border-2 border-yellow-400 rounded-2xl bg-yellow-50` |
| 애니메이션 중 | `border border-blue-300 rounded-2xl bg-blue-50 animate-pulse` |

---

## 5. `src/app/page.tsx` 수정 사항

### 5.1 추가 위치

Stats(카운트업 카드) 아래, 탭 섹션 위:

```tsx
{/* Stats */}
<div className="grid grid-cols-4 gap-3">
  <AnimatedStat ... />
</div>

{/* NEW: Debug Injector Panel */}
{result && code && (
  <DebugInjectorPanel
    code={code}
    result={result}
    fileName={fileName}
  />
)}

{/* Tabs */}
<section className="bg-white rounded-2xl ...">
  ...
</section>
```

### 5.2 dynamic import 추가

```tsx
const DebugInjectorPanel = dynamic(
  () => import('@/components/DebugInjectorPanel'),
  { ssr: false }
);
```

---

## 6. `src/lib/log-parser.ts` 설계 (WOW-05 — v2)

붙여넣기 로그를 파싱해 타임라인 엔트리로 변환:

```typescript
export interface TimelineEntry {
  seq: number;            // 실행 순서
  line: number;           // 원본 소스 줄번호
  category: string;       // props | state | effect | handler | render
  componentName: string;
  label: string;          // 한국어 설명
  value?: string;         // 변수값 (있을 경우)
  isStateChange?: boolean; // 이전과 다른 값이면 true → 강조 표시
  renderCount?: number;   // render인 경우 몇 번째 렌더인지
}

// 파싱 정규식
// [L:42][MyComp][props] { name: "홍길동" }
const LOG_PATTERN = /\[L:(\d+)\]\[([^\]]+)\](?:\[([^\]]+)\])?\s*(.*)/;

export function parseLogOutput(rawLog: string): TimelineEntry[] { ... }
export function detectStateChanges(entries: TimelineEntry[]): TimelineEntry[] { ... }
export function countRenders(entries: TimelineEntry[]): TimelineEntry[] { ... }
```

---

## 7. 새로 만들 파일 & 수정 파일

### 신규

| 파일 | 주요 export |
|------|------------|
| `src/lib/debug-injector.ts` | `injectLogs`, `removeInjectedLogs`, `predictExecutionOrder`, `getSmartLabel` |
| `src/lib/log-parser.ts` (v2) | `parseLogOutput`, `detectStateChanges` |
| `src/components/DebugInjectorPanel.tsx` | `default export DebugInjectorPanel` |

### 수정

| 파일 | 변경 내용 |
|------|----------|
| `src/app/page.tsx` | `DebugInjectorPanel` dynamic import + 렌더링 추가 |

---

## 8. 구현 순서 (Do 단계 체크리스트)

```
[ ] 1. src/lib/debug-injector.ts
       - getSmartLabel()
       - makeMarker()
       - buildInjectionPoints()
       - injectLogs()
       - removeInjectedLogs()
       - predictExecutionOrder()

[ ] 2. src/components/DebugInjectorPanel.tsx
       - Props / State 정의
       - handleInject() + 카운트업 애니메이션
       - handleCopy() + handleDownloadOriginal()
       - 원본 모드 UI
       - 주입 완료 UI (실행 순서 예측 + 사용 가이드)

[ ] 3. src/app/page.tsx
       - dynamic import 추가
       - DebugInjectorPanel 렌더링 추가

[ ] 4. (v2) src/lib/log-parser.ts + 타임라인 UI
```

---

## 9. 엣지 케이스 처리

| 케이스 | 처리 방법 |
|--------|----------|
| 파싱 에러 있는 소스 | `result.parseError` 있어도 동작 (부분 주입) |
| 컴포넌트 0개 | 패널 숨김 또는 "분석 결과 없음" 메시지 |
| 같은 줄에 주입 겹침 | `Set<number>` dedup으로 방지 |
| 클립보드 API 없음 | try-catch → 복사 실패 무음 처리 |
| 소스 매우 긴 경우 | injectLogs는 동기 연산, 10000줄 미만 충분히 빠름 |

---

## 10. 성공 검증 기준

- [ ] 파일 로드 → 패널 표시 (주입 없음)
- [ ] [Log 주입] → 카운트업 애니메이션 → 완료
- [ ] 주입 완료 → 노란 테두리 + "주입됨" 배지
- [ ] 실행 순서 예측 올바른 순서로 표시
- [ ] 스마트 한국어 라벨 변수명에 따라 동작
- [ ] [코드 복사] → 클립보드에 주입된 소스 복사
- [ ] [원본 백업] → `.original.tsx` 다운로드
- [ ] [원본으로 복귀] → 즉시 원본 모드 전환
- [ ] 재분석 시 패널 상태 초기화

---

## 다음 단계

구현 시작: `src/lib/debug-injector.ts` → `DebugInjectorPanel.tsx` → `page.tsx` 수정
