# Design: ux-delight — 엔드유저 감동 업그레이드

**작성일**: 2026-02-23
**레벨**: Dynamic
**참조 플랜**: `docs/01-plan/features/ux-delight.plan.md`

---

## 코드 분석 요약 (현재 상태)

| 파일 | 현재 역할 | 변경 필요 |
|------|---------|---------|
| `src/components/TldrCard.tsx` | 요약 + 복사 버튼(이미 구현) | F-20 추천 카드 추가 |
| `src/components/DangerCard.tsx` | 위험 패턴 표시, 줄 번호 텍스트만 | F-17 줄 번호 → 클릭 버튼 |
| `src/components/ConceptCards.tsx` | 개념 카드 + 줄 번호 텍스트만 | F-17 줄 번호 → 클릭 버튼 |
| `src/components/HookCards.tsx` | 훅 카드 + 줄 번호 텍스트만 | F-17 줄 번호 → 클릭 버튼 |
| `src/components/CodeInput.tsx` | 코드 입력 + 줄 번호 패널 | F-17 scrollToLine 노출 (forwardRef) |
| `src/app/page.tsx` | 전체 상태 관리 | F-17 콜백 연결, F-19 히스토리, F-21 애니메이션 |
| `src/app/globals.css` | fadeIn 1개 있음 | F-21 fadeInUp + delay 추가 |

### 이미 구현된 것 → 제외
- **F-18 결과 복사**: TldrCard에 📋 복사 버튼 + `generateMarkdownReport` 완전 구현됨

---

## F-17: 카드 → 코드 줄 하이라이트 연동

### 설계 목표
위험 신호 / 필수 개념 / 훅 카드의 줄 번호를 클릭하면
CodeInput 코드 영역이 해당 줄로 스크롤되고 줄 번호가 1.5초간 강조됨

### 구현 패턴: `forwardRef` + `useImperativeHandle`

**CodeInput.tsx 변경**
```tsx
// 1. 인터페이스 추가
export interface CodeInputHandle {
  scrollToLine: (line: number) => void;
}

// 2. forwardRef 래핑
const CodeInput = forwardRef<CodeInputHandle, Props>(({ ... }, ref) => {
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  // 3. ref로 scrollToLine 노출
  useImperativeHandle(ref, () => ({
    scrollToLine: (line: number) => {
      const lineHeight = 20; // leading-5 = 1.25rem = 20px
      const scrollTop = (line - 1) * lineHeight;
      if (textareaRef.current) textareaRef.current.scrollTop = scrollTop;
      if (lineNumRef.current)  lineNumRef.current.scrollTop  = scrollTop;
      setHighlightedLine(line);
      setTimeout(() => setHighlightedLine(null), 1500);
    }
  }));

  // 4. 줄 번호 패널에 하이라이트 적용
  // <div className={`leading-5 transition-colors duration-300
  //   ${highlightedLine === i + 1 ? 'bg-yellow-300 text-gray-900 rounded' : ''}`}>
});
```

**page.tsx 변경**
```tsx
const codeInputRef = useRef<CodeInputHandle>(null);
const handleScrollToLine = useCallback((line: number) => {
  // 분석 결과 탭이 보이는 상태에서 CodeInput 영역으로 먼저 스크롤
  codeInputRef.current?.scrollToLine(line);
}, []);

// CodeInput에 ref 연결
<CodeInput ref={codeInputRef} ... />

// 각 탭 컴포넌트에 onScrollToLine 전달
<DangerCard   dangers={dangers}   onScrollToLine={handleScrollToLine} />
<ConceptCards concepts={concepts} hooks={result.hooks} onScrollToLine={handleScrollToLine} />
<HookCards    hooks={result.hooks} onScrollToLine={handleScrollToLine} />
```

**DangerCard.tsx 변경**
```tsx
// Props에 추가
interface Props {
  dangers: DangerItem[];
  onScrollToLine?: (line: number) => void;
}

// 줄 번호 텍스트 → 클릭 버튼으로 교체
// 기존: <span className="text-xs text-gray-500">📍 {l}줄</span>
// 변경:
{d.lines.slice(0, 3).map(l => (
  <button
    key={l}
    onClick={(e) => { e.stopPropagation(); onScrollToLine?.(l); }}
    className="text-xs text-blue-600 hover:underline hover:text-blue-800 transition-colors"
  >
    {l}줄
  </button>
))}
```

**ConceptCards.tsx, HookCards.tsx**: 동일 패턴으로 줄 번호 버튼화

---

## F-19: 최근 분석 히스토리 (localStorage)

### 데이터 구조
```ts
// src/lib/history.ts
interface HistoryItem {
  id: string;        // crypto.randomUUID()
  fileName: string;
  code: string;
  lineCount: number;
  analyzedAt: string; // ISO string
}

const STORAGE_KEY = 'srcxray-history';
const MAX_ITEMS = 5;

export function saveHistory(fileName: string, code: string): void
export function loadHistory(): HistoryItem[]
export function deleteHistory(id: string): void
```

### UI: HistoryPanel 컴포넌트
```
src/components/HistoryPanel.tsx

빈 화면(result 없을 때)에서만 표시, 샘플 버튼 위에 위치

┌─────────────────────────────┐
│ 🕐 최근 분석한 파일           │
│ UserList.tsx   42줄  5분 전 [×] │
│ ProductCard.tsx 120줄 어제  [×] │
└─────────────────────────────┘
```

**page.tsx 연동**
```tsx
// 분석 성공 시 히스토리 저장
setResult(analysis);
saveHistory(fileName, inputCode); // ← 추가

// 히스토리 클릭 시 코드 로드
<HistoryPanel
  onSelect={(item) => { handleReset(); setCode(item.code); setFileName(item.fileName); }}
/>
```

---

## F-20: 다음 학습 추천

### 로직
```ts
// src/lib/next-learning.ts
interface NextTopic {
  emoji: string;
  title: string;
  reason: string; // "useState를 쓰고 있어서"
  url: string;    // MDN, React 공식문서
}

// 개념 id → 추천 매핑
const NEXT_MAP: Record<string, NextTopic[]> = {
  'useState':   [{ emoji: '🔄', title: 'useReducer', reason: '복잡한 상태 관리에 필요', url: '...' }],
  'useEffect':  [{ emoji: '⚡', title: 'React Query', reason: '서버 데이터 패칭에 강력', url: '...' }],
  'props':      [{ emoji: '🌐', title: 'Context API', reason: '여러 컴포넌트에 데이터 전달', url: '...' }],
  'async-await':[{ emoji: '🛡️', title: '에러 바운더리', reason: '비동기 에러 처리 필수', url: '...' }],
  'form':       [{ emoji: '📋', title: 'React Hook Form', reason: '폼 검증을 쉽게', url: '...' }],
};

export function getNextTopics(conceptIds: string[]): NextTopic[]
```

### UI: TldrCard 하단에 추가
```
(기존 TldrCard 맨 아래)
─────────────────────────────
📚 다음에 이걸 배워보세요
  🔄 useReducer   — 복잡한 상태 관리
  🌐 Context API  — 전역 상태 관리
[각 항목 클릭 → 공식문서 새 탭]
```

---

## F-21: 분석 결과 순차 페이드인

### globals.css 추가
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-fadeInUp { animation: fadeInUp 0.4s ease-out both; }
.animation-delay-100 { animation-delay: 100ms; }
.animation-delay-200 { animation-delay: 200ms; }
```

### page.tsx 적용
```tsx
{result && (
  <>
    {/* TldrCard: delay 0 (기존 animate-fadeIn 유지) */}
    <TldrCard ... />

    {/* Stats: delay 100ms */}
    <div className="grid grid-cols-4 gap-3 animate-fadeInUp animation-delay-100">
      ...
    </div>

    {/* Tabs: delay 200ms */}
    <section className="... animate-fadeInUp animation-delay-200">
      ...
    </section>
  </>
)}
```

---

## 구현 순서

| 순서 | 작업 | 파일 | 예상 시간 |
|------|------|------|---------|
| 1 | F-21 애니메이션 CSS | `globals.css` | 5분 |
| 2 | F-21 page.tsx 클래스 적용 | `page.tsx` | 5분 |
| 3 | F-17 CodeInput forwardRef | `CodeInput.tsx` | 20분 |
| 4 | F-17 page.tsx ref + 콜백 | `page.tsx` | 10분 |
| 5 | F-17 DangerCard 줄 버튼 | `DangerCard.tsx` | 10분 |
| 6 | F-17 ConceptCards 줄 버튼 | `ConceptCards.tsx` | 10분 |
| 7 | F-17 HookCards 줄 버튼 | `HookCards.tsx` | 10분 |
| 8 | F-19 history.ts | `src/lib/history.ts` (신규) | 15분 |
| 9 | F-19 HistoryPanel.tsx | `src/components/HistoryPanel.tsx` (신규) | 20분 |
| 10 | F-19 page.tsx 연동 | `page.tsx` | 10분 |
| 11 | F-20 next-learning.ts | `src/lib/next-learning.ts` (신규) | 15분 |
| 12 | F-20 TldrCard 추천 UI | `TldrCard.tsx` | 15분 |

---

## 신규/수정 파일

```
신규:
  src/lib/history.ts              ← F-19 localStorage 히스토리
  src/lib/next-learning.ts        ← F-20 다음 학습 추천 매핑
  src/components/HistoryPanel.tsx ← F-19 히스토리 UI

수정:
  src/app/globals.css             ← F-21 fadeInUp keyframe + delay
  src/app/page.tsx                ← F-17 ref + 콜백, F-19 저장, F-21 클래스
  src/components/CodeInput.tsx    ← F-17 forwardRef + scrollToLine + 하이라이트
  src/components/DangerCard.tsx   ← F-17 줄 번호 클릭 버튼
  src/components/ConceptCards.tsx ← F-17 줄 번호 클릭 버튼
  src/components/HookCards.tsx    ← F-17 줄 번호 클릭 버튼
  src/components/TldrCard.tsx     ← F-20 다음 학습 추천 UI
```

---

## 다음 단계

구현 시작 → 우선순위 순서대로 (F-21 → F-17 → F-19 → F-20)
