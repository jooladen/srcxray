# Design: wow-features — 왕초보 개발자 물개박수 기능 상세 설계

**생성일**: 2026-02-22
**상태**: Design
**참조 Plan**: `docs/01-plan/features/wow-features.plan.md`

---

## 1. 아키텍처 변경 개요

```
현재 (AS-IS)                         변경 후 (TO-BE)
─────────────────────                ─────────────────────────────────
src/lib/parser.ts                    src/lib/parser.ts          (확장)
src/components/                      src/lib/tldr.ts            (신규)
  CodeInput.tsx                      src/lib/hook-explainer.ts  (신규)
  ComponentTree.tsx                  src/lib/complexity.ts      (신규)
  ImportMap.tsx                      src/lib/report-text.ts     (신규)
  FunctionList.tsx                   src/components/
  LearningGuide.tsx                    TldrCard.tsx             (신규)
src/app/page.tsx                       FlowDiagram.tsx          (신규)
                                       CodeHeatmap.tsx          (신규)
                                       (기존 컴포넌트 소폭 수정)
                                     src/app/page.tsx           (수정)
```

**신규 파일**: 7개 (lib 4개 + component 2개 + page 수정)
**수정 파일**: 2개 (parser.ts, page.tsx)
**외부 의존성 추가**: 없음 (순수 TS + CSS)

---

## 2. 타입/인터페이스 설계

### 2-1. parser.ts 확장 (AnalysisResult)

```typescript
// 기존 AnalysisResult에 추가
export interface AnalysisResult {
  // ... 기존 필드 유지 ...
  tldr: FileTldr;              // F-01 신규
  lineComplexity: number[];    // F-04 신규 (인덱스 = 줄번호-1)
}

export interface FileTldr {
  summary: string;             // "사용자 목록 표시 컴포넌트. 외부 API 연동."
  role: string[];              // ["목록 표시", "검색 필터링", "외부 API"]
  badges: TldrBadge[];
}

export interface TldrBadge {
  label: string;               // "컴포넌트 1개"
  color: 'blue' | 'purple' | 'orange' | 'green' | 'gray';
}
```

### 2-2. hook-explainer.ts 타입

```typescript
export interface HookExplanation {
  hookName: string;
  stateVar?: string;
  plain: string;               // "목록을 저장하는 바구니입니다"
  emoji: string;               // "🧺"
  pattern: string;             // "목록 관리"
}
```

### 2-3. FlowDiagram 타입

```typescript
export interface FlowNode {
  id: string;
  kind: 'prop' | 'state' | 'effect' | 'jsx';
  label: string;
  line?: number;
}

export interface FlowEdge {
  from: string;
  to: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}
```

---

## 3. F-01: 파일 TL;DR 카드

### 3-1. lib/tldr.ts 로직

**입력**: `AnalysisResult` (기존 파싱 결과)
**출력**: `FileTldr`

```
규칙 기반 요약 생성 로직:

Step 1. 역할 감지 (Role Detection)
  - hasForm     : jsxTags에 'form' | 'input' | 'textarea' 포함
  - hasList     : jsxTags에 'ul' | 'li' | 'table' 포함
  - hasFetch    : imports에 fetch 관련 OR useEffect + 빈 deps
  - hasAuth     : imports source에 'auth' | 'session' | 'user' 포함
  - hasRouter   : imports source에 'router' | 'navigation' 포함
  - hasModal    : jsxTags에 'dialog' | 'Modal' | 'Drawer' 포함

Step 2. 요약 문장 조합
  "[컴포넌트명]을/를 [역할1] + [역할2]하는 컴포넌트"

Step 3. 뱃지 생성
  - 컴포넌트 수, useState 수, useEffect 수, 총 줄 수
```

**요약 문장 예시 매핑**:

| 감지 패턴 | 생성 텍스트 |
|----------|-----------|
| hasList + hasFetch | "외부에서 데이터를 가져와 목록으로 표시" |
| hasForm | "사용자 입력을 받는 폼 컴포넌트" |
| hasAuth | "로그인/인증 상태를 처리" |
| hasModal | "팝업/모달 UI를 표시" |
| hasList only | "항목 목록을 보여주는 컴포넌트" |
| default | "UI를 렌더링하는 컴포넌트" |

### 3-2. TldrCard.tsx UI

```
┌─────────────────────────────────────────────────────────┐
│  📋 이 파일이 하는 일                                    │
│                                                         │
│  "외부에서 데이터를 가져와 목록으로 표시하고             │
│   검색 필터링을 지원하는 컴포넌트"                      │
│                                                         │
│  [🧩 컴포넌트 1개] [⚡ useState 3개] [📏 87줄]         │
└─────────────────────────────────────────────────────────┘
```

**스타일**:
- 배경: `bg-gradient-to-r from-blue-600 to-indigo-600`
- 텍스트: white
- 뱃지: `bg-white/20` 반투명
- 위치: stats bar 바로 위 (탭 패널 상단)
- 애니메이션: `animate-fadeIn` (간단한 CSS transition)

---

## 4. F-02: 훅 역할 자동 번역

### 4-1. lib/hook-explainer.ts 규칙 테이블

**useState 패턴 분류**:

| 초기값 타입 | stateVar 이름 패턴 | 설명 | 이모지 |
|------------|------------------|------|--------|
| `false` / `true` | - | "켜고/끄는 스위치 (토글)" | 💡 |
| `''` / `""` | `search`, `query`, `filter` | "검색어를 담는 입력값" | 🔍 |
| `''` / `""` | `name`, `email`, `value` | "사용자 입력 텍스트를 저장" | ✏️ |
| `[]` | `list`, `items`, `data`, `users` | "목록 데이터를 담는 바구니" | 🧺 |
| `null` / `undefined` | `user`, `data`, `item` | "하나의 객체 데이터를 저장" | 📦 |
| `0` | `count`, `index`, `page` | "숫자를 세거나 순서를 기억" | 🔢 |
| 기타 | - | "화면에 보여줄 값을 저장" | 💾 |

**useEffect 패턴 분류**:

| deps 패턴 | 설명 |
|----------|------|
| `[]` (빈 배열) | "화면이 처음 열릴 때 딱 한 번 실행" |
| `[id]` (단일 변수) | "id가 바뀔 때마다 자동으로 실행" |
| `[a, b]` (복수) | "a 또는 b 중 하나가 바뀌면 자동 실행" |
| deps 없음 | "모든 렌더링마다 실행 (주의 필요)" |

**기타 훅**:

| 훅 | 설명 | 이모지 |
|---|------|--------|
| `useCallback` | "함수를 캐시해 불필요한 재생성 방지" | 🗂️ |
| `useMemo` | "복잡한 계산 결과를 캐시" | 🧠 |
| `useRef` | "DOM 요소를 직접 가리키거나 값을 기억" | 📌 |
| `useContext` | "전역 상태/설정값을 가져옴" | 🌐 |
| `useRouter` | "현재 URL 정보나 이동 기능 사용" | 🗺️ |
| 커스텀 `use*` | "프로젝트 내부의 재사용 가능한 로직" | 🔧 |

### 4-2. 적용 위치

`ComponentTree.tsx`의 `HookBadge` 컴포넌트 수정:
- 배지 클릭 시 아래 설명 토글 (accordion)
- 설명: 이모지 + 평문 텍스트

```
[useState → users 🧺] ← 클릭
  ↓ 펼침
  "목록 데이터를 담는 바구니입니다. users에 배열이 저장되고,
   setUsers로 내용을 바꿀 수 있습니다."
```

---

## 5. F-03: 데이터 흐름 화살표

### 5-1. FlowGraph 추출 로직 (parser.ts 확장)

```
추출 규칙:
1. Props 노드: 컴포넌트 파라미터 → kind='prop'
2. State 노드: useState 선언 → kind='state'
3. Effect 노드: useEffect → kind='effect'
4. JSX 노드: 주요 JSX 태그들 → kind='jsx'

엣지 규칙:
- prop → state  : useEffect/useState의 초기값이 prop인 경우
- state → effect : useEffect deps에 state 변수 포함
- state → jsx   : JSX에서 state 변수를 텍스트/속성에 사용
- effect → state : effect 내에서 setter 함수 호출
```

### 5-2. FlowDiagram.tsx UI

```
[Props]          [State]          [Effect]         [JSX 출력]
────────         ────────         ────────         ──────────
userId   ──→    user      ──→   fetchUser  ──→   <UserCard>
title    ──→    loading   ←──   (setLoad)
                search    ──────────────────→   <input>
                                               <ul><li>
```

**구현 방식**:
- 4컬럼 레이아웃 (CSS grid)
- 화살표: `→` 유니코드 + `border-t` CSS로 연결선
- 각 노드: 클릭 시 `📍 23줄` 힌트 표시
- 반응형: 모바일에서 세로 스택

### 5-3. 노드 색상

| kind | 색상 |
|------|------|
| prop | indigo |
| state | blue |
| effect | orange |
| jsx | green |

---

## 6. F-04: 복잡도 히트맵

### 6-1. complexity.ts 점수 계산

```
줄별 복잡도 점수:

기본값: 1점

가산 규칙:
+2 : async/await 키워드
+2 : 훅 호출 (useState, useEffect 등)
+1 : 삼항연산자 (? :)
+1 : 논리연산자 (&&, ||)
+1 : 중첩 {}마다 (들여쓰기 레벨)
+1 : JSX 태그마다
+3 : try/catch 블록

색상 매핑:
0-2점 → 초록  (bg-green-100)   "단순"
3-5점 → 노랑  (bg-yellow-100)  "보통"
6-9점 → 주황  (bg-orange-100)  "복잡"
10+점 → 빨강  (bg-red-100)     "매우 복잡 — 집중해서 읽기"
```

### 6-2. CodeHeatmap.tsx UI

```
줄번호  복잡도  코드
──────  ──────  ──────────────────────────────
  1    ░░░░░░  import React, { useState }...   ← 초록
 23    ░░░░░░  const [users, setUsers] = ...   ← 초록
 45    ████░░  useEffect(async () => {         ← 노랑
 46    ██████  const res = await fetch(url)    ← 주황
 67    ██████  .then(d => d.json())           ← 빨강
```

**구현**:
- 스크롤 가능한 코드 뷰어 (`max-h-96 overflow-y-auto`)
- 줄별 왼쪽에 색상 바 (`w-1 rounded`)
- hover 시 "복잡도 점수: 7점" tooltip
- 코드는 `<pre>` + `font-mono text-xs`

---

## 7. F-05: 결과 복사 버튼

### 7-1. lib/report-text.ts

```typescript
generateMarkdownReport(result, fileName) → string

출력 예:
# UserList.tsx 분석 요약
생성일시: 2026-02-22 13:00

## 파일 개요
- 역할: 외부에서 데이터를 가져와 목록으로 표시
- 전체 줄: 87줄 / 컴포넌트: 1개

## 컴포넌트
- UserList (23-87줄)
  - Props: title, maxItems
  - 상태: users(목록바구니), loading(스위치), search(검색어)

## Import 목록
- [외부] react, @/lib/api
- [내부] @/components/ui/Button

## 학습 포인트
1. useEffect로 컴포넌트 마운트 시 데이터 로드
2. useState로 검색 필터링 구현
```

**버튼 위치**: TldrCard 우측 상단 `📋 복사` 버튼

---

## 8. F-06: 읽기 타이머

### 8-1. page.tsx 상태 추가

```typescript
const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
const [elapsedSeconds, setElapsedSeconds] = useState(0);
// 분석 시작 시 startTime 기록
// setInterval로 elapsedSeconds 업데이트
// "분석 완료" 버튼 클릭 시 표시
```

### 8-2. UI

```
⏱️ 분석 시작 후 3분 27초 경과
[✅ 분석 완료!]
  ↓ 클릭 시
🎉 "3분 27초 만에 87줄 코드 분석 완료! 대단해요!"
```

성취 메시지 기준:
- 5분 미만: "🚀 엄청 빠르다! 천재인가요?"
- 10분 미만: "👏 목표 달성! 10분 안에 성공!"
- 10분 이상: "💪 끝까지 완주! 다음엔 더 빠를 거예요!"

---

## 9. 구현 순서 (Do Phase 가이드)

```
Step 1: lib/tldr.ts + TldrCard.tsx (F-01)          ← 30분
  └─ parser.ts에 tldr 필드 추가
  └─ page.tsx에 TldrCard 삽입

Step 2: lib/hook-explainer.ts (F-02)                ← 20분
  └─ ComponentTree.tsx HookBadge 수정

Step 3: lib/complexity.ts + CodeHeatmap.tsx (F-04)  ← 40분
  └─ parser.ts에 lineComplexity 추가
  └─ page.tsx 탭에 히트맵 추가

Step 4: FlowDiagram.tsx (F-03)                      ← 45분
  └─ parser.ts에 flowGraph 추출 로직 추가

Step 5: lib/report-text.ts + 복사 버튼 (F-05)       ← 15분

Step 6: 타이머 (F-06)                               ← 10분
  └─ page.tsx 상태 추가
```

**총 예상 작업**: ~2.5시간

---

## 10. 검증 기준 (Gap Analysis 기준)

| 항목 | 확인 방법 |
|------|---------|
| F-01 TL;DR | 샘플 코드 분석 시 요약 카드 표시 여부 |
| F-02 훅 번역 | useState([]) → "목록 바구니" 설명 출력 |
| F-03 흐름도 | Props/State/JSX 노드 3개 이상 + 엣지 표시 |
| F-04 히트맵 | 줄별 색상 3가지 이상 구분 표시 |
| F-05 복사 | 복사 버튼 클릭 → 클립보드에 마크다운 저장 |
| F-06 타이머 | 분석 시작 시 초 증가, 완료 클릭 시 축하 메시지 |

---

## 11. 다음 단계

→ `/pdca do wow-features` 로 구현 시작
