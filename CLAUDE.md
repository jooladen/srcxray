# SrcXray — TSX 소스 분석기

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
npm run dev    # 개발 서버 (http://localhost:3000)
npm run build  # 프로덕션 빌드
npm run lint   # 린트 검사
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
