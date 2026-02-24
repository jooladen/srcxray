# SrcXray — TSX 소스 분석기

See @README.md for project overview and @package.json for available scripts.

## 프로젝트 개요
왕초보 개발자가 500줄 이상의 React TSX 코드를 10분 안에 파악하도록 돕는 정적 분석 도구.

**레벨**: Dynamic
**목표**: 브라우저에서 완전 오프라인 동작 (코드 외부 전송 없음)

## 기술 스택
- **Next.js 16** (App Router)
- **Tailwind CSS 4**
- **@babel/parser** — TSX AST 파싱
- TypeScript

## 주요 파일
- `src/lib/parser.ts` — 핵심 AST 파싱 엔진
- `src/app/page.tsx` — 메인 분석 페이지
- `src/components/CodeInput.tsx` — 파일 업로드 / 코드 입력
- `src/components/ComponentTree.tsx` — 컴포넌트 구조 시각화
- `src/components/ImportMap.tsx` — import 분류 맵
- `src/components/FunctionList.tsx` — 함수/훅 목록
- `src/components/LearningGuide.tsx` — 10분 학습 가이드

## 개발 명령어
```bash
pnpm dev        # 개발 서버 (http://localhost:3000)
pnpm build      # 프로덕션 빌드
pnpm lint       # 린트 검사
pnpm typecheck  # 타입 검사
```

## 분석 기능
1. **Import 맵** — 외부 패키지 vs 내부 파일, 카테고리 분류
2. **컴포넌트 트리** — Props, Hooks, JSX 태그 추출
3. **함수 목록** — 컴포넌트 / 유틸리티 함수 구분
4. **10분 학습 가이드** — 코드 구조 기반 자동 생성

## 코딩 컨벤션
- 모든 컴포넌트: `'use client'` (브라우저 파싱 필요)
- 타입 캐스팅: `as unknown as T` 패턴 사용 (babel AST 호환)
- 파일명: PascalCase 컴포넌트, camelCase 유틸리티

## 에러 처리 규칙
- AST 파싱 실패 시: 사용자에게 에러 메시지 표시, throw 금지 (graceful degradation)
- 컴포넌트 렌더링 에러: ErrorBoundary 패턴 사용
- console.error 대신 구조화된 에러 객체 반환 (`{ success: false, error: string }`)

## 금지 패턴
- `any` 타입 사용 금지 (불가피 시 `as unknown as T`)
- 외부 API 호출 / 네트워크 요청 금지 (오프라인 원칙)
- `useEffect` 남용 금지 (useMemo/useCallback 우선)
- `document.querySelector` 등 직접 DOM 조작 금지 (React ref 사용)
- `// eslint-disable` 주석 금지

## 검증 절차
- IMPORTANT: 모든 변경 후 반드시 `pnpm typecheck && pnpm lint && pnpm build` 순서로 확인
- `parser.ts` 변경 시: 예제 TSX로 파싱 결과 검증 필수
- 컴포넌트 변경 시: 브라우저에서 육안 확인
- UI 변경 시: 모바일/데스크톱 반응형 레이아웃 테스트

## 컨텍스트 관리 규칙
- 3개 이상 파일 변경 시 Plan Mode 먼저 사용할 것
- 코드베이스 탐색은 서브에이전트에 위임하여 메인 컨텍스트 보호
- compact 시 보존 항목: 수정된 파일 목록, 테스트 명령어, 에러 메시지
- 관련 없는 작업 전환 시 /clear 사용

## 성능 최적화 규칙
- `docs/` 폴더는 `/pdca` 명령 실행 시에만 참조할 것. 일반 질문·에러 디버깅 시 docs/ 탐색 금지
- 에러 디버깅 시 `src/` 내 관련 파일만 읽을 것. 전체 탐색하지 말 것
- 사용자가 파일 경로를 명시하면 해당 파일만 읽고 바로 답변할 것
- PDCA 문서 작업과 코드 디버깅은 분리하여 처리할 것

-항상 한국어로 대답합니다.
