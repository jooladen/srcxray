# Design: Anti-Pattern Detector (데이터 드리븐)

> 기능명: `antipattern-detector`
> Plan 참조: `docs/01-plan/features/antipattern-detector.plan.md`
> 작성일: 2026-02-26

## 1. 아키텍처 개요

```
antipatterns.json ──→ danger-detector.ts ──→ DangerCard.tsx
  (규칙 데이터)         (매칭 엔진)           (UI 렌더링)
                            ↑
                     AnalysisResult
                      (parser.ts)
```

**변경 범위**: 3개 파일 수정 + 1개 파일 생성 (최소 변경 원칙)

## 2. 데이터 설계: antipatterns.json

### 2.1 파일 위치
`src/data/antipatterns.json`

### 2.2 스키마

```typescript
interface AntiPatternRule {
  id: string;                    // 고유 ID (kebab-case)
  level: 'critical' | 'high' | 'medium' | 'low';
  category: 'hooks' | 'rendering' | 'state' | 'performance' | 'security' | 'style';
  emoji: string;
  title: string;                 // 한글 제목
  why: string;                   // "왜 위험한가요?"
  fix: string;                   // "어떻게 고치나요?"
  detect: DetectConfig;          // 감지 설정
}

// 감지 전략 (3가지)
type DetectConfig =
  | { type: 'regex'; pattern: string; flags?: string }
  | { type: 'regex-context'; pattern: string; flags?: string; context: ContextConfig }
  | { type: 'count'; target: string; min: number };

interface ContextConfig {
  scope: 'hook-body' | 'component-body' | 'callback' | 'condition';
  hookName?: string;  // scope=hook-body일 때 대상 Hook
}
```

### 2.3 전체 규칙 목록 (18개)

#### CRITICAL (절대 금지) — 6개

```json
[
  {
    "id": "fetch-in-usememo",
    "level": "critical",
    "category": "hooks",
    "emoji": "🚨",
    "title": "useMemo 안에서 데이터 fetch 금지",
    "why": "useMemo는 렌더링 중 동기적으로 실행됩니다. fetch는 비동기 사이드이펙트이므로 여기서 호출하면 안 됩니다.",
    "fix": "useEffect + useState 조합으로 데이터를 fetch하세요. 또는 React Query/SWR을 사용하세요.",
    "detect": {
      "type": "regex-context",
      "pattern": "\\b(fetch|axios|api\\.|http\\.)\\s*\\(",
      "context": { "scope": "hook-body", "hookName": "useMemo" }
    }
  },
  {
    "id": "fetch-in-render",
    "level": "critical",
    "category": "rendering",
    "emoji": "🚨",
    "title": "컴포넌트 본문에서 직접 fetch 호출",
    "why": "매 렌더링마다 네트워크 요청이 발생합니다. 무한 요청 + 성능 재앙.",
    "fix": "useEffect 안에서 fetch하거나, React Query/SWR을 사용하세요.",
    "detect": {
      "type": "regex-context",
      "pattern": "\\b(fetch|axios)\\s*\\(",
      "context": { "scope": "component-body" }
    }
  },
  {
    "id": "setstate-in-render",
    "level": "critical",
    "category": "rendering",
    "emoji": "🚨",
    "title": "렌더링 중 setState 직접 호출",
    "why": "컴포넌트 본문에서 setState → 리렌더 → setState → 무한 루프!",
    "fix": "setState는 이벤트 핸들러나 useEffect 안에서만 호출하세요.",
    "detect": {
      "type": "regex-context",
      "pattern": "\\bset[A-Z]\\w*\\s*\\(",
      "context": { "scope": "component-body" }
    }
  },
  {
    "id": "mutate-state-direct",
    "level": "critical",
    "category": "state",
    "emoji": "🚨",
    "title": "state 객체/배열 직접 변경 금지",
    "why": "React는 참조 비교로 변경을 감지합니다. 직접 변경하면 리렌더가 일어나지 않아요.",
    "fix": "스프레드 연산자 [...arr] 또는 structuredClone()으로 새 객체를 만드세요.",
    "detect": {
      "type": "regex",
      "pattern": "\\b\\w+\\.push\\(|\\b\\w+\\.splice\\(|\\b\\w+\\.sort\\((?!.*\\.slice)|\\b\\w+\\[\\w+\\]\\s*="
    }
  },
  {
    "id": "hooks-in-condition",
    "level": "critical",
    "category": "hooks",
    "emoji": "🚨",
    "title": "조건문/반복문 안에서 Hook 호출 금지",
    "why": "React Hook은 매 렌더링마다 같은 순서로 호출되어야 합니다. 조건부 호출 시 순서가 꼬여요.",
    "fix": "Hook은 항상 컴포넌트 최상위 레벨에서 호출하세요. 조건 로직은 Hook 내부에 넣으세요.",
    "detect": {
      "type": "regex-context",
      "pattern": "\\buse[A-Z]\\w*\\s*\\(",
      "context": { "scope": "condition" }
    }
  },
  {
    "id": "hooks-in-callback",
    "level": "critical",
    "category": "hooks",
    "emoji": "🚨",
    "title": "이벤트 핸들러/콜백 안에서 Hook 호출 금지",
    "why": "Hook은 React 렌더링 사이클에서만 동작합니다. 콜백에서 호출하면 에러가 발생해요.",
    "fix": "Hook은 컴포넌트 최상위에서 호출하고, 콜백에서는 Hook의 반환값만 사용하세요.",
    "detect": {
      "type": "regex-context",
      "pattern": "\\buse[A-Z]\\w*\\s*\\(",
      "context": { "scope": "callback" }
    }
  }
]
```

#### HIGH (매우 위험) — 4개

```json
[
  {
    "id": "async-effect",
    "level": "high",
    "category": "hooks",
    "emoji": "🔄",
    "title": "useEffect에 async 직접 사용",
    "why": "비동기 함수를 직접 전달하면 클린업이 불가능하고 메모리 누수가 생길 수 있어요.",
    "fix": "useEffect 내부에 async 함수를 별도로 선언하고 호출하세요.",
    "detect": { "type": "regex", "pattern": "useEffect\\s*\\(\\s*async" }
  },
  {
    "id": "infinite-loop",
    "level": "high",
    "category": "hooks",
    "emoji": "♾️",
    "title": "useEffect 무한 루프 위험",
    "why": "deps 없는 useEffect에서 setState를 호출하면 렌더링 → useEffect → setState 무한 반복!",
    "fix": "useEffect 두 번째 인수에 의존하는 값 배열 []을 추가하세요.",
    "detect": { "type": "special", "handler": "infiniteLoop" }
  },
  {
    "id": "dangerously-set-html",
    "level": "high",
    "category": "security",
    "emoji": "⚠️",
    "title": "dangerouslySetInnerHTML 사용 — XSS 위험",
    "why": "외부 데이터를 HTML로 주입하면 스크립트 실행 공격(XSS)에 노출됩니다.",
    "fix": "가능하면 React 컴포넌트로 렌더링하세요. 불가피하면 DOMPurify로 sanitize 후 사용.",
    "detect": { "type": "regex", "pattern": "dangerouslySetInnerHTML" }
  },
  {
    "id": "useeffect-missing-cleanup",
    "level": "high",
    "category": "hooks",
    "emoji": "🧹",
    "title": "useEffect에서 구독/타이머 클린업 누락",
    "why": "addEventListener, setInterval, subscribe 등을 useEffect에서 등록하고 해제하지 않으면 메모리 누수!",
    "fix": "useEffect의 return 함수에서 removeEventListener, clearInterval 등으로 정리하세요.",
    "detect": {
      "type": "regex-context",
      "pattern": "\\b(addEventListener|setInterval|setTimeout|subscribe)\\s*\\(",
      "context": { "scope": "hook-body", "hookName": "useEffect" }
    }
  }
]
```

#### MEDIUM (위험) — 5개

```json
[
  {
    "id": "map-no-key",
    "level": "medium",
    "category": "rendering",
    "emoji": "🔑",
    "title": ".map()에 key prop 누락",
    "why": "React가 목록 항목을 구별 못해서 잘못된 곳이 업데이트되거나 버그가 생겨요.",
    "fix": "목록 최상위 요소에 고유한 key={item.id}를 추가하세요.",
    "detect": { "type": "special", "handler": "mapNoKey" }
  },
  {
    "id": "index-as-key",
    "level": "medium",
    "category": "rendering",
    "emoji": "🔢",
    "title": "key={index} 사용 — 목록 변경 시 버그",
    "why": "항목 추가/삭제/재정렬 시 index가 바뀌어 React가 DOM을 잘못 매칭해요.",
    "fix": "고유한 ID 값을 key로 사용하세요. 없으면 crypto.randomUUID()로 생성.",
    "detect": { "type": "regex", "pattern": "key=\\{\\s*(i|idx|index)\\s*\\}" }
  },
  {
    "id": "object-literal-in-jsx",
    "level": "medium",
    "category": "performance",
    "emoji": "🔁",
    "title": "JSX에 인라인 객체/배열 리터럴",
    "why": "매 렌더링마다 새 참조가 생성되어 자식 컴포넌트가 불필요하게 리렌더됩니다.",
    "fix": "useMemo로 객체를 메모이제이션하거나, 컴포넌트 외부 상수로 분리하세요.",
    "detect": { "type": "regex", "pattern": "(?:style|className|options|data|config)=\\{\\{" }
  },
  {
    "id": "useeffect-as-derived",
    "level": "medium",
    "category": "hooks",
    "emoji": "🔀",
    "title": "useEffect로 파생 상태 계산 — useMemo로 대체 가능",
    "why": "불필요한 리렌더 1회가 추가로 발생합니다. useEffect는 사이드이펙트 전용!",
    "fix": "const derived = useMemo(() => compute(a, b), [a, b]) 로 대체하세요.",
    "detect": { "type": "special", "handler": "effectAsDerived" }
  },
  {
    "id": "no-error-boundary",
    "level": "medium",
    "category": "rendering",
    "emoji": "💥",
    "title": "에러 바운더리 없이 async 데이터 렌더링",
    "why": "런타임 에러 발생 시 전체 앱이 흰 화면으로 크래시됩니다.",
    "fix": "ErrorBoundary 컴포넌트로 감싸거나 Suspense + fallback을 사용하세요.",
    "detect": { "type": "regex", "pattern": "\\bSuspense\\b(?!.*fallback)|throw\\s+new\\s+Error" }
  }
]
```

#### LOW (개선 권장) — 3개

```json
[
  {
    "id": "console-log",
    "level": "low",
    "category": "style",
    "emoji": "📝",
    "title": "console.log 잔존",
    "why": "개발 중 디버깅 코드가 배포에 포함되면 성능에 영향을 줄 수 있어요.",
    "fix": "배포 전 console.log를 제거하거나 환경변수로 조건부 처리하세요.",
    "detect": { "type": "regex", "pattern": "console\\.(log|warn|error)\\s*\\(" }
  },
  {
    "id": "too-many-states",
    "level": "low",
    "category": "state",
    "emoji": "🗂️",
    "title": "useState 5개 이상 — 커스텀 훅 고려",
    "why": "상태가 너무 많으면 컴포넌트가 복잡해지고 관리하기 어려워요.",
    "fix": "관련 상태들을 custom hook으로 묶으면 코드가 깔끔해져요.",
    "detect": { "type": "count", "target": "useState", "min": 5 }
  },
  {
    "id": "any-type",
    "level": "low",
    "category": "style",
    "emoji": "🏷️",
    "title": "any 타입 사용 — 타입 안전성 저하",
    "why": "TypeScript의 보호 기능이 무력화되어 런타임 에러를 사전에 잡지 못해요.",
    "fix": "구체적 타입, unknown, 또는 제네릭을 사용하세요.",
    "detect": { "type": "regex", "pattern": ":\\s*any\\b|<any>|as\\s+any\\b" }
  }
]
```

## 3. 모듈 설계: danger-detector.ts 리팩터링

### 3.1 타입 변경

```typescript
// 기존 유지 + critical 추가
export type DangerLevel = 'critical' | 'high' | 'medium' | 'low';

// DangerItem — 기존 호환 + category 추가
export interface DangerItem {
  id: string;
  level: DangerLevel;
  category: string;
  emoji: string;
  title: string;
  description: string;   // JSON의 why 매핑
  solution: string;      // JSON의 fix 매핑
  lines: number[];
}
```

### 3.2 엔진 함수 구조

```typescript
import antipatterns from '@/data/antipatterns.json';

export function detectDangers(code: string, result: AnalysisResult): DangerItem[] {
  const lines = code.split('\n');
  const dangers: DangerItem[] = [];

  for (const rule of antipatterns) {
    const matched = matchRule(rule, lines, code, result);
    if (matched.length > 0) {
      dangers.push({
        id: rule.id,
        level: rule.level,
        category: rule.category,
        emoji: rule.emoji,
        title: rule.title,
        description: rule.why,
        solution: rule.fix,
        lines: matched,
      });
    }
  }

  return sortByLevel(dangers);
}

// 감지 전략 라우터
function matchRule(rule, lines, code, result): number[] {
  switch (rule.detect.type) {
    case 'regex':       return matchRegex(rule.detect, lines);
    case 'regex-context': return matchRegexContext(rule.detect, lines, code, result);
    case 'count':       return matchCount(rule.detect, result);
    case 'special':     return matchSpecial(rule.detect.handler, lines, code, result);
  }
}
```

### 3.3 감지 전략 상세

#### `regex` — 단순 정규식 (줄 단위)
```typescript
function matchRegex(detect, lines): number[] {
  const re = new RegExp(detect.pattern, detect.flags || 'g');
  return lines.reduce((acc, line, i) => {
    if (re.test(line)) acc.push(i + 1);
    re.lastIndex = 0;
    return acc;
  }, []);
}
```

#### `regex-context` — 특정 스코프 안에서만 매칭
- `hook-body`: 특정 Hook 콜백 내부 줄만 검사
- `component-body`: 컴포넌트 함수 본문 (Hook/JSX return 외부) 줄만 검사
- `condition`: if/for/while 블록 내부 줄만 검사
- `callback`: onClick, onChange 등 이벤트 핸들러 내부 줄만 검사

**스코프 계산**: `result.hooks` + `result.components`의 startLine/endLine 활용

#### `count` — 패턴 등장 횟수
```typescript
function matchCount(detect, result): number[] {
  const count = result.hooks.filter(h => h.name === detect.target).length;
  return count >= detect.min ? [] : []; // 빈 lines = 파일 전체
}
```

#### `special` — 복잡한 로직 (기존 하드코딩 보존)
기존 `infinite-loop`, `map-no-key`, `effectAsDerived` 등은 AST 결합 분석이 필요하므로 special handler로 유지.

## 4. UI 설계: DangerCard.tsx 변경

### 4.1 LEVEL_STYLE 확장

```typescript
const LEVEL_STYLE = {
  critical: {
    bg: 'bg-red-100 border-red-500 border-2',
    badge: 'bg-red-600 text-white',
    label: '🚨 절대 금지'
  },
  high:   { bg: 'bg-red-50 border-red-300',    badge: 'bg-red-100 text-red-700',    label: '🔴 높음' },
  medium: { bg: 'bg-yellow-50 border-yellow-300', badge: 'bg-yellow-100 text-yellow-700', label: '🟡 중간' },
  low:    { bg: 'bg-blue-50 border-blue-300',  badge: 'bg-blue-100 text-blue-700',  label: '🔵 낮음' },
};
```

### 4.2 Critical 배너

critical 레벨이 1개 이상이면 목록 상단에 경고 배너 표시:

```
┌─────────────────────────────────────────┐
│ 🚨 치명적 안티패턴 N개 발견!            │
│ 아래 항목은 반드시 수정해야 합니다.      │
└─────────────────────────────────────────┘
```

### 4.3 정렬 순서

`critical → high → medium → low` (기존 high→medium→low에 critical 추가)

## 5. 파일 변경 목록

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `src/data/antipatterns.json` | **신규** | 18개 안티패턴 규칙 데이터 |
| `src/lib/danger-detector.ts` | **수정** | JSON 기반 엔진으로 리팩터링 |
| `src/components/DangerCard.tsx` | **수정** | critical 레벨 UI + 배너 추가 |

## 6. 구현 순서

1. `src/data/antipatterns.json` 생성 (18개 규칙)
2. `src/lib/danger-detector.ts` 리팩터링
   - JSON import + 타입 정의
   - matchRule 라우터 + 각 매칭 함수
   - 기존 special handler 마이그레이션
3. `src/components/DangerCard.tsx` critical UI 추가
4. `pnpm typecheck && pnpm lint && pnpm build` 검증

## 7. 하위 호환성

- `DangerItem` 인터페이스: `category` 필드 추가 (optional로 시작 가능)
- `detectDangers(code, result)` 시그니처 동일
- `DangerCard` props 동일 (`{ dangers, onScrollToLine }`)
- 기존 5개 규칙 결과 동일 보장
