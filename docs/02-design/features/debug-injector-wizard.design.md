# Design: debug-injector-wizard

**작성일**: 2026-02-23
**Plan 참조**: `docs/01-plan/features/debug-injector-wizard.plan.md`
**목표**: 5단계 Stepper UX + UI 요소 맵 CSV 내보내기

---

## 1. 아키텍처 개요

```
page.tsx
  └─ DebugInjectorPanel.tsx  ← 전체 리팩터 (Stepper 방식으로)
       ├─ WizardProgress      (진행 도트 표시)
       ├─ Step1Ready          (분석 완료 카드)
       ├─ Step2Inject         (주입 + 카운트업)
       ├─ Step3Preview        (실행순서 예측)
       ├─ Step4Copy           (복사 + 사용 가이드)
       └─ Step5Complete       (완주 + CSV 다운로드)

src/lib/ui-map-extractor.ts  ← 신규
  └─ extractUiElements()     (JSX 스캔 → UiElement[])
  └─ generateCsv()           (UiElement[] → CSV string)
```

---

## 2. 상태 머신 (State Machine)

### 상태 타입

```typescript
type WizardStep = 1 | 2 | 3 | 4 | 5;

interface WizardState {
  step: WizardStep;           // 현재 단계
  injecting: boolean;         // Step2: 주입 애니메이션 진행 중
  animatedCount: number;      // Step2: 카운트업 현재값
  injectedSource: string;     // 주입된 코드
  breakdown: InjectionBreakdown | null;
  totalCount: number;
  steps: ExecutionStep[];     // 실행순서 예측
  copied: boolean;            // Step4: 복사 완료 여부
  csvDownloaded: boolean;     // Step5: CSV 다운로드 여부
}
```

### 전환 규칙 (허용되는 step 이동)

```
step 1 → step 2  : 항상 가능 (다음 버튼)
step 2 → step 3  : injecting === false 일 때만 (카운트업 완료 후)
step 3 → step 4  : 항상 가능 (실행순서 확인 후)
step 4 → step 5  : 항상 가능 (복사 여부 무관)
step N → step N-1: 항상 가능 (← 뒤로 버튼)
step 5 → step 1  : 처음으로 버튼 (상태 완전 초기화)
```

### 초기 상태

```typescript
const INITIAL_STATE: WizardState = {
  step: 1,
  injecting: false,
  animatedCount: 0,
  injectedSource: '',
  breakdown: null,
  totalCount: 0,
  steps: [],
  copied: false,
  csvDownloaded: false,
};
```

---

## 3. 컴포넌트 설계

### 3-1. WizardProgress (진행 표시줄)

```tsx
// Props
interface WizardProgressProps {
  currentStep: WizardStep;    // 현재 단계
  totalSteps: 5;
}

// 렌더링 예시 (Step 3 진행 중)
// ●─●─●─○─○
// 완료: filled circle (●, text-blue-600)
// 현재: filled + pulse ring (●, ring-blue-300)
// 미완: empty circle (○, text-gray-300)
// 연결선: 완료 구간은 bg-blue-600, 미완은 bg-gray-200
```

```tsx
// 레이아웃 (Tailwind)
<div className="flex items-center gap-0 mb-5">
  {[1,2,3,4,5].map(n => (
    <Fragment key={n}>
      {/* 도트 */}
      <div className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
        n < current  && 'bg-blue-600 text-white',
        n === current && 'bg-blue-600 text-white ring-4 ring-blue-100',
        n > current  && 'bg-gray-200 text-gray-400',
      )}>
        {n < current ? '✓' : n}
      </div>
      {/* 연결선 (마지막 제외) */}
      {n < 5 && (
        <div className={cn(
          'h-0.5 flex-1',
          n < current ? 'bg-blue-600' : 'bg-gray-200',
        )} />
      )}
    </Fragment>
  ))}
</div>
```

---

### 3-2. Step 1 — 준비 완료

**트리거**: 코드 로드 + 분석 완료 즉시 표시
**목적**: "얼마나 많은 위치에 log를 넣을 수 있는지" 미리 보여줌 → WOW #1

```
┌─────────────────────────────────────────────┐
│  ●──○──○──○──○  Step 1 / 5                 │
│                                              │
│  🎉 분석 완료!                              │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 🧩 props │  │ ⚡ state │  │ 🔁effect │  │
│  │    2개   │  │    3개   │  │    2개   │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│  ┌──────────┐  ┌──────────┐                 │
│  │ 🔧 fn   │  │ 🖼 render│                 │
│  │    5개   │  │    1개   │                 │
│  └──────────┘  └──────────┘                 │
│                                              │
│      총 13개 위치에 Log를 넣을 수 있어요    │
│                                              │
│            [다음: Log 주입하기 →]           │
└─────────────────────────────────────────────┘
```

**데이터**: `injectLogs(code, result)` 를 Step 1 진입 시 **미리 계산** (애니메이션 없이)
→ Step 2에서 애니메이션만 재생하면 됨 (지연 없음)

```typescript
// Step 1 진입 시 처리
useEffect(() => {
  const { injectLogs, predictExecutionOrder } = await import('@/lib/debug-injector');
  const injResult = injectLogs(code, result);
  const execSteps = predictExecutionOrder(result);
  setState(s => ({
    ...s,
    injectedSource: injResult.injectedSource,
    breakdown: injResult.breakdown,
    totalCount: injResult.totalCount,
    steps: execSteps,
  }));
}, []); // 마운트 한 번만
```

---

### 3-3. Step 2 — Log 주입

**트리거**: "다음: Log 주입하기 →" 버튼 클릭
**목적**: 카운트업 애니메이션 WOW #2, 완료 후 자동으로 "다음" 버튼 활성화

```
┌─────────────────────────────────────────────┐
│  ●──●──○──○──○  Step 2 / 5                 │
│                                              │
│  🔧 Log 주입 중...                         │
│                                              │
│  ████████████████░░░ 10 / 13개             │
│                                              │
│  [애니메이션 완료 후]                        │
│                                              │
│  ✅ 13개 위치에 주입 완료!                 │
│  props:2  state:3  effect:2  fn:5  render:1 │
│                                              │
│  ← 뒤로           [다음: 실행순서 보기 →]  │
└─────────────────────────────────────────────┘
```

**카운트업 구현**:
```typescript
// Step 2 진입 시 실행
const runAnimation = (target: number) => {
  setState(s => ({ ...s, injecting: true, animatedCount: 0 }));
  const duration = 700; // 0.7초
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
    setState(s => ({ ...s, animatedCount: Math.round(eased * target) }));
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      setState(s => ({ ...s, injecting: false, animatedCount: target }));
    }
  };
  requestAnimationFrame(tick);
};
```

---

### 3-4. Step 3 — 실행 순서 예측

**트리거**: Step 2 완료 후 "다음" 버튼
**목적**: React 실행 순서를 단독 화면으로 보여줌 WOW #3

```
┌─────────────────────────────────────────────┐
│  ●──●──●──○──○  Step 3 / 5                 │
│                                              │
│  🔮 이런 순서로 로그가 찍힐 거예요          │
│                                              │
│  ── Mount (처음 실행) ─────────────────     │
│  1️⃣ [L:12] MyComp 시작 → props 수신        │
│  2️⃣ [L:15] count = 0 초기화 (숫자카운터)  │
│  3️⃣ [L:50] 첫 번째 render                 │
│  4️⃣ [L:20] useEffect 실행 (처음 한 번만)  │
│                                              │
│  ── 상태 변경 후 ──────────────────────     │
│  5️⃣ setCount() → 상태 변경 → 재render 발생│
│                                              │
│  ← 뒤로              [다음: 코드 복사 →]   │
└─────────────────────────────────────────────┘
```

---

### 3-5. Step 4 — 복사 & 실행 가이드

**트리거**: Step 3에서 "다음" 버튼
**목적**: 사용 가이드를 단독 화면으로 제공 WOW #4

```
┌─────────────────────────────────────────────┐
│  ●──●──●──●──○  Step 4 / 5                 │
│                                              │
│  📋 주입된 코드를 복사하세요                │
│                                              │
│  [📋 코드 복사]  ← 클릭 후 "✅ 복사됨!"   │
│  [💾 원본 백업]                              │
│                                              │
│  ── 이렇게 하세요 ─────────────────────    │
│  Step 1.  VSCode에서 원본 파일 열기         │
│  Step 2.  Ctrl+A → Ctrl+V                  │
│  Step 3.  npm run dev                       │
│  Step 4.  F12 → Console 탭 열기            │
│  Step 5.  컴포넌트 사용 → [L:번호] 확인 🎉 │
│                                              │
│  ← 뒤로         [다음: 완주 보고서 →]      │
└─────────────────────────────────────────────┘
```

---

### 3-6. Step 5 — 완주 + CSV 내보내기

**트리거**: Step 4에서 "다음" 버튼
**목적**: 완주 축하 + UI 맵 CSV 다운로드 WOW #5

```
┌─────────────────────────────────────────────┐
│  ●──●──●──●──●  Step 5 / 5  🎊 완주!      │
│                                              │
│  🏆 분석 완료!                              │
│  총 13개 위치 문서화 · 실행순서 4단계 예측  │
│                                              │
│  ─── 📊 UI 요소 맵 다운로드 ──────────    │
│  버튼, 입력, 링크의 위치와 핸들러를         │
│  엑셀에서 바로 열 수 있는 CSV로 저장해요   │
│                                              │
│  MyComponent.ui-map.csv                     │
│  (발견된 요소: button 3개, input 2개)       │
│                                              │
│  [⬇ CSV 다운로드]   [💾 원본 백업]         │
│                                              │
│                          [↩ 처음으로]       │
└─────────────────────────────────────────────┘
```

---

## 4. `ui-map-extractor.ts` 설계

### 4-1. 출력 타입

```typescript
export interface UiElement {
  component: string;     // 소속 컴포넌트명
  tagName: string;       // button | input | a | select | textarea | form
  textContent: string;   // JSX 텍스트 내용 (없으면 "")
  nameAttr: string;      // name 속성값 (input 등)
  line: number;          // 소스 줄번호
  eventName: string;     // onClick | onChange | onSubmit | ...
  handlerExpr: string;   // 핸들러 표현식 (handleLogin | setEmail | ...)
  handlerLine: number;   // 핸들러 함수 줄번호 (찾으면) | 0
}
```

### 4-2. 파싱 전략

```typescript
// 대상 JSX 태그
const TARGET_TAGS = new Set(['button', 'input', 'a', 'select', 'textarea', 'form', 'Link']);

// 추출할 이벤트 속성
const EVENT_PROPS = ['onClick', 'onChange', 'onSubmit', 'onKeyDown', 'onKeyUp', 'onBlur', 'onFocus'];
```

**AST 순회 방식** (`@babel/parser` 재사용):

```typescript
import { parse } from '@babel/parser';
import type { AnalysisResult } from './parser';

export function extractUiElements(source: string, result: AnalysisResult): UiElement[] {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    errorRecovery: true,
  });

  const elements: UiElement[] = [];

  // 컴포넌트 이름을 줄번호로 빠르게 찾기 위한 맵
  const compByLine = buildComponentLineMap(result);

  // AST 순회: JSXOpeningElement 노드만 탐색
  traverseJsx(ast, (node, ancestors) => {
    if (node.type !== 'JSXOpeningElement') return;

    const tagName = getTagName(node); // 'button', 'input' 등
    if (!TARGET_TAGS.has(tagName)) return;

    const line = node.loc?.start.line ?? 0;
    const component = findContainingComponent(line, compByLine);

    // 이벤트 속성 추출
    for (const attr of node.attributes) {
      if (attr.type !== 'JSXAttribute') continue;
      const eventName = getAttrName(attr);
      if (!EVENT_PROPS.includes(eventName)) continue;

      const handlerExpr = getHandlerExpr(attr);   // "handleLogin" | "() => setCount(c+1)"
      const handlerLine = findHandlerLine(handlerExpr, result);

      elements.push({
        component,
        tagName,
        textContent: extractTextContent(node, ancestors, source),
        nameAttr: getAttrValue(node, 'name'),
        line,
        eventName,
        handlerExpr,
        handlerLine,
      });
    }
  });

  return elements;
}
```

### 4-3. `findHandlerLine` — 핸들러 줄번호 탐색

```typescript
function findHandlerLine(handlerExpr: string, result: AnalysisResult): number {
  // 1. result.functions에서 이름 매칭
  const fn = result.functions.find(f => f.name === handlerExpr);
  if (fn) return fn.startLine;

  // 2. result.components[].hooks에서 setState 패턴 감지
  //    "setCount" → count state의 줄번호
  const setterMatch = handlerExpr.match(/^set([A-Z]\w*)/);
  if (setterMatch) {
    const stateVar = setterMatch[1].charAt(0).toLowerCase() + setterMatch[1].slice(1);
    for (const comp of result.components) {
      const hook = comp.hooks.find(h => h.stateVar === stateVar);
      if (hook) return hook.line;
    }
  }

  return 0; // 찾지 못하면 0
}
```

### 4-4. `generateCsv` — CSV 생성

```typescript
const CSV_HEADERS = ['컴포넌트', '요소타입', '텍스트/name', '줄번호', '이벤트', '핸들러', '핸들러줄'];

export function generateCsv(elements: UiElement[]): string {
  const BOM = '\uFEFF'; // 엑셀 한글 깨짐 방지

  const rows = elements.map(el => [
    el.component,
    el.tagName,
    el.textContent || el.nameAttr || '',
    String(el.line),
    el.eventName,
    el.handlerExpr,
    el.handlerLine > 0 ? String(el.handlerLine) : '-',
  ]);

  const csvContent = [CSV_HEADERS, ...rows]
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  return BOM + csvContent;
}
```

### 4-5. CSV 다운로드 (브라우저)

```typescript
export function downloadCsv(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName; // "MyComponent.ui-map.csv"
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## 5. 데이터 흐름

```
코드 로드 (code + result 수신)
    │
    ▼
[마운트 시 미리 계산] ─────────────────────────────────────────
│  injectLogs(code, result)    → injectedSource, breakdown, totalCount
│  predictExecutionOrder(result) → steps
│  extractUiElements(code, result) → uiElements  ← 신규
└──────────────────────────────────────────────────────────────
    │
    ▼
Step 1: 준비완료 카드 표시 (breakdown 미리보기)
    │ 다음 버튼
    ▼
Step 2: 카운트업 애니메이션 (0 → totalCount)
    │ 완료 자동 감지 → 다음 버튼 활성화
    ▼
Step 3: 실행순서 예측 (steps 표시)
    │ 다음 버튼
    ▼
Step 4: 코드 복사 + 사용 가이드
    │ 다음 버튼
    ▼
Step 5: 완주 + CSV 다운로드 (uiElements → generateCsv → download)
    │ 처음으로 버튼
    ▼
Step 1 초기화
```

---

## 6. AnalysisResult 타입 확인 (파서 의존성)

`ui-map-extractor.ts`가 필요한 `AnalysisResult` 필드:

| 필드 | 사용 목적 |
|------|----------|
| `components[].name` | 소속 컴포넌트명 |
| `components[].startLine` / `endLine` | 어느 컴포넌트 내부인지 판단 |
| `components[].hooks[].stateVar` | setState 패턴 → 줄번호 연결 |
| `components[].hooks[].line` | useState 줄번호 |
| `functions[].name` | 핸들러 이름 매칭 |
| `functions[].startLine` | 핸들러 줄번호 |

→ 기존 파서 변경 없음. `extractUiElements`가 추가 파싱만 담당.

---

## 7. 파일 변경 요약

| 파일 | 변경 유형 | 변경 내용 |
|------|----------|----------|
| `src/components/DebugInjectorPanel.tsx` | **수정** | 단일 패널 → 5단계 Stepper로 전체 리팩터 |
| `src/lib/ui-map-extractor.ts` | **신규** | JSX 요소 추출 + CSV 생성 |
| `src/lib/debug-injector.ts` | 변경 없음 | 기존 로직 그대로 사용 |
| `src/lib/parser.ts` | 변경 없음 | AnalysisResult 타입 그대로 사용 |
| `src/app/page.tsx` | 변경 없음 | DebugInjectorPanel props 동일 |

---

## 8. 엣지 케이스 처리

| 상황 | 처리 방식 |
|------|----------|
| JSX 이벤트 없는 버튼 (`<button>`) | CSV에서 제외 |
| 익명 핸들러 (`onClick={() => ...}`) | handlerExpr = "익명함수", handlerLine = 0 |
| 텍스트 없는 버튼 (`<button><Icon/></button>`) | textContent = "" |
| 컴포넌트가 0개 | DebugInjectorPanel 숨김 (기존 동작 유지) |
| UI 요소가 0개 | Step 5에서 CSV 버튼 숨기고 "이 파일에는 이벤트 요소가 없어요" 표시 |
| `@babel/parser` 파싱 실패 | errorRecovery: true → 부분 결과 사용 |

---

## 9. 완료 기준 (Done Criteria)

- [ ] `WizardProgress` — 5개 도트, 완료/현재/미완 스타일 구분
- [ ] Step 1 — breakdown 미리보기 카드 (5종 뱃지)
- [ ] Step 2 — 카운트업 0→N 애니메이션 (0.7초), 완료 후 다음 버튼 활성
- [ ] Step 3 — mount / update 섹션 분리 표시
- [ ] Step 4 — 코드 복사 + 사용 가이드 (5스텝)
- [ ] Step 5 — 완주 배너 + CSV 다운로드 버튼
- [ ] `extractUiElements` — button/input/a/form 이벤트 추출
- [ ] `generateCsv` — BOM 포함, 6열, 엑셀 한글 깨짐 없음
- [ ] 뒤로 가기 버튼 (← 뒤로) 모든 step에서 동작
- [ ] 처음으로 버튼 → INITIAL_STATE 초기화

---

## 10. 다음 단계

`/pdca do debug-injector-wizard` → 구현 시작
1. `src/lib/ui-map-extractor.ts` 신규 작성
2. `src/components/DebugInjectorPanel.tsx` Stepper로 리팩터
